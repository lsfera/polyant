// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";
import { mergeEvent } from "@/lib/activity-stream/merge";
import type { FeedEvent } from "@/lib/activity-stream/types";
import { isNoiseEvent } from "../_lib/noise-filter";

/**
 * Live feed of agent activity, fed by a single SSE connection to
 * `GET /api/activity-stream/live`. The endpoint is fire-and-forget on the
 * server: events emitted while no client is connected are dropped, and a
 * client that connects mid-turn only sees subsequent events.
 *
 * Auth comes from the JWT cookie set by Auth.js — `EventSource` ships
 * cookies automatically for same-origin URLs, which is what the Next.js
 * rewrites give us (relative path, proxied to the engine).
 */

const MAX_BUFFERED_EVENTS = 500;

interface UseActivityStreamResult {
  events: FeedEvent[];
  /** True while the SSE connection is open. */
  realLive: boolean;
  /** Last connection error, cleared on successful reconnect. */
  error: string | null;
}

export function useActivityStream(): UseActivityStreamResult {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [realLive, setRealLive] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/activity-stream/live");
    sourceRef.current = source;

    source.onopen = () => {
      setRealLive(true);
      setError(null);
    };

    source.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data) as FeedEvent;
        if (isNoiseEvent(evt)) return;
        // Tool calls and agent-to-agent handoffs arrive as a `:start`/`:end`
        // pair; mergeEvent folds the pair into a single row that mutates
        // from "pending" to "completed". Non-paired ids fall through to
        // plain dedup + capped append.
        setEvents((prev) => mergeEvent(prev, evt, MAX_BUFFERED_EVENTS));
      } catch {
        // Ignore malformed messages — never break the stream over a bad chunk.
      }
    };

    source.onerror = () => {
      setRealLive(false);
      setError("connection lost");
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, []);

  return { events, realLive, error };
}
