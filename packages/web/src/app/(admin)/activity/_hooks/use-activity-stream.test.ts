// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useActivityStream } from "./use-activity-stream";
import type { FeedEvent } from "@/lib/activity-stream/types";

/**
 * Minimal stand-in for the browser `EventSource` API. Stores the latest
 * instance on the constructor so tests can drive `onmessage`/`onopen` from
 * the outside.
 */
class MockEventSource {
  static last: MockEventSource | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.last = this;
  }

  emit(payload: FeedEvent): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  close(): void {
    this.closed = true;
  }
}

const ORIGINAL_EVENT_SOURCE = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.last = null;
  // jsdom does not implement EventSource. Swap in the mock for the duration
  // of the test.
  (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;
});

afterEach(() => {
  (globalThis as unknown as { EventSource: unknown }).EventSource = ORIGINAL_EVENT_SOURCE;
});

function ev(overrides: Partial<FeedEvent> & { id: string }): FeedEvent {
  const { id, ts, persona, text, ...rest } = overrides;
  return {
    id,
    ts: ts ?? "2026-05-14T10:00:00.000Z",
    persona: persona ?? "agent",
    text: text ?? "tool args",
    ...rest,
  };
}

describe("useActivityStream — start/end merge", () => {
  test("folds tool :start and :end into a single row", () => {
    const { result } = renderHook(() => useActivityStream());
    const source = MockEventSource.last!;

    act(() => {
      source.emit(
        ev({
          id: "tool:c1:abc:start",
          tool: { name: "hubspotNote", summary: "search" },
          argsPreview: "action=search",
        }),
      );
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].status).toBeUndefined();
    expect(result.current.events[0].id).toBe("tool:c1:abc:start");

    act(() => {
      source.emit(
        ev({
          id: "tool:c1:abc:end",
          tool: { name: "hubspotNote", summary: "search" },
          status: "success",
          durationMs: 320,
          resultPreview: "found",
        }),
      );
    });

    expect(result.current.events).toHaveLength(1);
    const merged = result.current.events[0];
    expect(merged.id).toBe("tool:c1:abc:end");
    expect(merged.status).toBe("success");
    expect(merged.durationMs).toBe(320);
    expect(merged.argsPreview).toBe("action=search");
    expect(merged.resultPreview).toBe("found");
  });

  test("preserves position of the :start when :end folds in", () => {
    const { result } = renderHook(() => useActivityStream());
    const source = MockEventSource.last!;

    act(() => {
      source.emit(ev({ id: "inbound:c1", text: "msg" }));
      source.emit(
        ev({
          id: "tool:c1:abc:start",
          tool: { name: "x", summary: "" },
        }),
      );
      source.emit(ev({ id: "thinking:c1", persona: "thinking", text: "reasoning…" }));
    });
    expect(result.current.events.map((e) => e.id)).toEqual([
      "inbound:c1",
      "tool:c1:abc:start",
      "thinking:c1",
    ]);

    act(() => {
      source.emit(
        ev({
          id: "tool:c1:abc:end",
          tool: { name: "x", summary: "" },
          status: "success",
          durationMs: 50,
        }),
      );
    });

    expect(result.current.events.map((e) => e.id)).toEqual([
      "inbound:c1",
      "tool:c1:abc:end",
      "thinking:c1",
    ]);
  });

  test("non-paired events are deduplicated by id", () => {
    const { result } = renderHook(() => useActivityStream());
    const source = MockEventSource.last!;

    const sameId = ev({
      id: "inb:c1",
      category: "inbound",
      channel: { type: "web", id: "1" },
    });

    act(() => {
      source.emit(sameId);
      source.emit(sameId);
    });

    expect(result.current.events).toHaveLength(1);
  });
});
