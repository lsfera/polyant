// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, test } from "vitest";
import { mergeEvent, stepId } from "./merge";
import type { FeedEvent } from "./types";

const MAX = 500;

function ev(overrides: Partial<FeedEvent> & { id: string }): FeedEvent {
  const { id, ts, persona, text, ...rest } = overrides;
  return {
    id,
    ts: ts ?? "2026-05-14T10:00:00.000Z",
    persona: persona ?? "agent",
    text: text ?? "",
    ...rest,
  };
}

describe("stepId", () => {
  test.each([
    ["tool:c1:abc:start", "tool:c1:abc"],
    ["tool:c1:abc:end", "tool:c1:abc"],
    ["handoff:c1:xyz:start", "handoff:c1:xyz"],
    ["handoff:c1:xyz:end", "handoff:c1:xyz"],
    ["webhook-evt-42", "webhook-evt-42"],
    ["inbound:c2", "inbound:c2"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(stepId(input)).toBe(expected);
  });
});

describe("mergeEvent — non-paired events", () => {
  test("appends a single event into an empty buffer", () => {
    const incoming = ev({ id: "inbound:c1" });
    const next = mergeEvent([], incoming, MAX);
    expect(next).toEqual([incoming]);
  });

  test("appends a single event onto a buffer", () => {
    const prev = [ev({ id: "a" }), ev({ id: "b" })];
    const incoming = ev({ id: "c" });
    const next = mergeEvent(prev, incoming, MAX);
    expect(next.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  test("dedup: appending the same non-paired id twice does NOT duplicate", () => {
    const a = ev({ id: "a" });
    const prev = [a];
    const next = mergeEvent(prev, a, MAX);
    // The second insert hits the findIndex match, but neither side has a
    // :start/:end suffix so mergePair returns the existing reference.
    expect(next).toBe(prev);
  });

  test("caps the buffer when oversized", () => {
    const prev = Array.from({ length: 3 }, (_, i) => ev({ id: `e${i}` }));
    const incoming = ev({ id: "new" });
    const next = mergeEvent(prev, incoming, 3);
    expect(next.map((e) => e.id)).toEqual(["e1", "e2", "new"]);
  });
});

describe("mergeEvent — paired :start/:end", () => {
  const baseId = "tool:c1:abc";

  test("appends a :start event with no existing match", () => {
    const start = ev({ id: `${baseId}:start`, argsPreview: "foo" });
    const next = mergeEvent([], start, MAX);
    expect(next).toEqual([start]);
  });

  test("folds :end into existing :start, preserving position", () => {
    const inbound = ev({ id: "inbound:c1" });
    const start = ev({
      id: `${baseId}:start`,
      ts: "2026-05-14T10:00:00.000Z",
      argsPreview: "args-from-start",
      tool: { name: "hubspotNote", summary: "summary" },
    });
    const trailing = ev({ id: "thinking:c1" });
    const prev = [inbound, start, trailing];

    const end = ev({
      id: `${baseId}:end`,
      ts: "2026-05-14T10:00:00.320Z",
      status: "success",
      durationMs: 320,
      resultPreview: "result-from-end",
    });
    const next = mergeEvent(prev, end, MAX);

    expect(next).toHaveLength(3);
    expect(next[0]).toBe(prev[0]);
    expect(next[2]).toBe(prev[2]);

    const merged = next[1];
    expect(merged.id).toBe(`${baseId}:end`);
    expect(merged.argsPreview).toBe("args-from-start");
    expect(merged.tool?.name).toBe("hubspotNote");
    expect(merged.status).toBe("success");
    expect(merged.durationMs).toBe(320);
    expect(merged.resultPreview).toBe("result-from-end");
    // ts comes from start (we want the "began at" timestamp).
    expect(merged.ts).toBe("2026-05-14T10:00:00.000Z");
  });

  test("folds :start arriving AFTER :end (out-of-order SSE)", () => {
    const end = ev({
      id: `${baseId}:end`,
      status: "success",
      durationMs: 100,
      resultPreview: "r",
    });
    const start = ev({
      id: `${baseId}:start`,
      ts: "2026-05-14T10:00:00.000Z",
      argsPreview: "a",
    });

    const afterEnd = mergeEvent([], end, MAX);
    const afterStart = mergeEvent(afterEnd, start, MAX);

    expect(afterStart).toHaveLength(1);
    const m = afterStart[0];
    expect(m.argsPreview).toBe("a");
    expect(m.status).toBe("success");
    expect(m.durationMs).toBe(100);
    expect(m.resultPreview).toBe("r");
  });

  test("idempotent on duplicate :end", () => {
    const start = ev({ id: `${baseId}:start`, argsPreview: "a" });
    const end = ev({ id: `${baseId}:end`, status: "success", durationMs: 50 });
    const once = mergeEvent([start], end, MAX);
    const twice = mergeEvent(once, end, MAX);
    expect(twice).toBe(once);
  });

  test("idempotent on duplicate :start", () => {
    const start = ev({ id: `${baseId}:start` });
    const once = mergeEvent([], start, MAX);
    const twice = mergeEvent(once, start, MAX);
    // Second :start matches the first via stepId, but mergePair sees two
    // :start values (no :end) and returns existing — referential equality.
    expect(twice).toBe(once);
  });

  test(":end standalone (no prior :start) is appended as a single row", () => {
    const end = ev({
      id: `${baseId}:end`,
      status: "success",
      durationMs: 200,
    });
    const next = mergeEvent([], end, MAX);
    expect(next).toEqual([end]);
  });

  test("handoff :start/:end pair folds the same way as tool", () => {
    const handoffBase = "handoff:c1:xyz";
    const start = ev({
      id: `${handoffBase}:start`,
      argsPreview: "ask target",
    });
    const end = ev({
      id: `${handoffBase}:end`,
      status: "error",
      durationMs: 1500,
      resultPreview: "fail",
    });
    const next = mergeEvent([start], end, MAX);
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe("error");
    expect(next[0].durationMs).toBe(1500);
  });
});
