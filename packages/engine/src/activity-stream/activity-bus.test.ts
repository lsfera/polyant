// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { activityBus } from "./activity-bus.js";
import type { FeedEvent } from "./activity-stream.types.js";

function makeEvent(id: string): FeedEvent {
  return {
    id,
    ts: new Date().toISOString(),
    persona: "agent",
    text: id,
  };
}

describe("ActivityBus", () => {
  beforeEach(() => {
    activityBus.__clearBuffer();
  });

  it("delivers events to all subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = activityBus.subscribe(a);
    const offB = activityBus.subscribe(b);

    activityBus.emitEvent(makeEvent("evt-1"));

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a.mock.calls[0][0].id).toBe("evt-1");
    expect(b.mock.calls[0][0].id).toBe("evt-1");

    offA();
    offB();
  });

  it("drops events when there are no subscribers", () => {
    // No throw, nothing to assert beyond no exception bubbling up.
    expect(() => activityBus.emitEvent(makeEvent("orphan"))).not.toThrow();
  });

  it("unsubscribe stops further deliveries", () => {
    const handler = vi.fn();
    const off = activityBus.subscribe(handler);
    activityBus.emitEvent(makeEvent("first"));
    off();
    activityBus.emitEvent(makeEvent("after-unsubscribe"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listenerCount tracks subscribers", () => {
    const before = activityBus.listenerCount();
    const off1 = activityBus.subscribe(() => undefined);
    const off2 = activityBus.subscribe(() => undefined);
    expect(activityBus.listenerCount()).toBe(before + 2);
    off1();
    off2();
    expect(activityBus.listenerCount()).toBe(before);
  });

  it("buffers recent events and replays them to new subscribers", () => {
    activityBus.emitEvent(makeEvent("a"));
    activityBus.emitEvent(makeEvent("b"));
    activityBus.emitEvent(makeEvent("c"));

    const handler = vi.fn();
    const off = activityBus.subscribe(handler);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls.map((c) => c[0].id)).toEqual(["a", "b", "c"]);

    activityBus.emitEvent(makeEvent("d"));
    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[3][0].id).toBe("d");

    off();
  });

  it("caps the buffer size and drops the oldest events", () => {
    // 200 emits, buffer is sized to 100 — only the last 100 should replay.
    for (let i = 0; i < 200; i++) activityBus.emitEvent(makeEvent(`e-${i}`));

    expect(activityBus.bufferSize()).toBe(100);

    const handler = vi.fn();
    const off = activityBus.subscribe(handler);
    expect(handler).toHaveBeenCalledTimes(100);
    expect(handler.mock.calls[0][0].id).toBe("e-100");
    expect(handler.mock.calls[99][0].id).toBe("e-199");
    off();
  });

  it("a listener that throws during replay does not break subsequent ones", () => {
    activityBus.emitEvent(makeEvent("x"));
    activityBus.emitEvent(makeEvent("y"));

    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();

    const offBad = activityBus.subscribe(bad);
    const offGood = activityBus.subscribe(good);

    expect(bad).toHaveBeenCalledTimes(2);
    expect(good).toHaveBeenCalledTimes(2);

    offBad();
    offGood();
  });
});
