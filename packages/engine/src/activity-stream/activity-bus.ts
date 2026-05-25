// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * In-process pub/sub bus for live activity events.
 *
 * Producers (the AI-gateway tap, the non-streaming batch emitter, the
 * per-category emitters under `emitters/`) call `emitEvent()`. Consumers
 * (the SSE controller and, if we ever want them, other in-process
 * listeners like analytics aggregators) call `subscribe()` and receive
 * every event from then on.
 *
 * Design choices:
 *   - Single-engine only. Multi-engine would need a Redis / NATS bridge,
 *     intentionally out of scope.
 *   - Bounded ring buffer (last `BUFFER_SIZE` events). When a new
 *     subscriber connects, the buffered events are replayed synchronously
 *     before any future emit reaches them — so the activity panel always
 *     has something to show on first paint, even when traffic is quiet.
 *     Buffer size is tuned for ~6–8 minutes of typical agent activity at
 *     a few events per turn (well under the SSE controller's 200-event
 *     per-client backpressure cap).
 *   - Synchronous emit. Listeners run inline on the producer's microtask;
 *     producers MUST treat emission as fire-and-forget (any thrown error
 *     in a listener bubbles back to the producer otherwise). The SSE
 *     controller wraps writes in try/catch + drops on backpressure.
 *   - `setMaxListeners(0)` disables Node's "possible memory leak" warning,
 *     which fires above 10 listeners by default. The activity panel may
 *     legitimately have a handful of admins connected.
 */

import { EventEmitter } from "node:events";
import type { FeedEvent } from "./activity-stream.types.js";

const EVENT_NAME = "event";

/**
 * How many recent events to keep in memory for replay on new subscribers.
 * 100 covers ~6–8 minutes of activity at the typical 5–15 events per
 * agent turn, fits in a few hundred KB of RAM and replays in a few ms
 * even on the slowest client. Bumping it higher only makes the panel
 * boot up with more legacy noise — keep it tight.
 */
const BUFFER_SIZE = 100;

class ActivityBus {
  private readonly emitter = new EventEmitter();
  private buffer: FeedEvent[] = [];

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  /**
   * Publish a single event. Always recorded into the ring buffer. If no
   * subscribers are attached the event is still buffered and will be
   * replayed when the next subscriber connects.
   */
  emitEvent(evt: FeedEvent): void {
    this.buffer.push(evt);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-BUFFER_SIZE);
    }
    this.emitter.emit(EVENT_NAME, evt);
  }

  /**
   * Register a listener. The buffered history (most recent
   * `BUFFER_SIZE` events) is replayed synchronously to the new listener
   * before live events start flowing. Returns an unsubscribe function —
   * callers MUST call it when they tear down (request close, component
   * unmount, …) to avoid leaking listeners across reconnects.
   */
  subscribe(handler: (evt: FeedEvent) => void): () => void {
    // Replay buffered history first. Failures in the handler abort the
    // replay loop but don't propagate — we keep going with the live
    // subscription so a single bad event doesn't break the connection.
    for (const evt of this.buffer) {
      try {
        handler(evt);
      } catch {
        // listener mis-behaved; continue
      }
    }
    this.emitter.on(EVENT_NAME, handler);
    return () => {
      this.emitter.off(EVENT_NAME, handler);
    };
  }

  /** Test/diagnostic helper. */
  listenerCount(): number {
    return this.emitter.listenerCount(EVENT_NAME);
  }

  /** Test/diagnostic helper. */
  bufferSize(): number {
    return this.buffer.length;
  }

  /** Test-only: drop the buffer. */
  __clearBuffer(): void {
    this.buffer = [];
  }
}

export const activityBus = new ActivityBus();
