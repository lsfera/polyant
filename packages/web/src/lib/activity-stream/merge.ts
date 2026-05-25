// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Activity Stream — client-side event merge.
 *
 * Tool calls and agent-to-agent handoffs are emitted by the backend as a
 * pair of events sharing a base id with `:start` and `:end` suffixes (see
 * `supervisor/index.ts` and `emit-agent-handoff.ts`). The UI needs to
 * render the pair as a single row that transitions from "pending" to
 * "completed", so we fold the pair into one event keyed by a shared
 * "step id" (= the original id minus the suffix).
 *
 * All other event ids have no `:start`/`:end` suffix, in which case the
 * stepId is just the id itself — the merge degenerates to plain dedup.
 *
 * Pure functions only. No React, no SSE — safe to unit-test in isolation.
 */

import type { FeedEvent } from "./types";

const SUFFIX_START = ":start";
const SUFFIX_END = ":end";

export function stepId(eventId: string): string {
  if (eventId.endsWith(SUFFIX_START)) return eventId.slice(0, -SUFFIX_START.length);
  if (eventId.endsWith(SUFFIX_END)) return eventId.slice(0, -SUFFIX_END.length);
  return eventId;
}

/**
 * Integrate `incoming` into `prev`, possibly folding it into an existing
 * event that shares the same stepId. Returns `prev` unchanged (same
 * reference) when the result is identical — callers can rely on referential
 * equality to skip React re-renders.
 */
export function mergeEvent(
  prev: FeedEvent[],
  incoming: FeedEvent,
  maxBuffered: number,
): FeedEvent[] {
  const incomingStep = stepId(incoming.id);
  const idx = prev.findIndex((e) => stepId(e.id) === incomingStep);

  if (idx === -1) {
    return appendCapped(prev, incoming, maxBuffered);
  }

  const merged = mergePair(prev[idx], incoming);
  if (merged === prev[idx]) return prev;

  const next = prev.slice();
  next[idx] = merged;
  return next;
}

/**
 * Fold two events sharing a stepId. The `:start` event carries the timing
 * context (ts, instance, tool, argsPreview, channel, handoff…); the `:end`
 * event carries the outcome (status, durationMs, resultPreview). The merge
 * is commutative — the order of arrival doesn't matter.
 *
 * If one of the two doesn't look like a paired event (no suffix), we return
 * the existing reference unchanged: it's either a duplicate of a single-shot
 * event or an edge case we don't want to corrupt.
 */
function mergePair(existing: FeedEvent, incoming: FeedEvent): FeedEvent {
  const start =
    existing.id.endsWith(SUFFIX_START)
      ? existing
      : incoming.id.endsWith(SUFFIX_START)
        ? incoming
        : null;
  const end =
    existing.id.endsWith(SUFFIX_END)
      ? existing
      : incoming.id.endsWith(SUFFIX_END)
        ? incoming
        : null;

  if (!start || !end) return existing;

  return {
    ...start,
    id: end.id,
    status: end.status,
    durationMs: end.durationMs,
    resultPreview: end.resultPreview,
  };
}

function appendCapped(prev: FeedEvent[], incoming: FeedEvent, maxBuffered: number): FeedEvent[] {
  if (prev.length < maxBuffered) {
    return [...prev, incoming];
  }
  // Drop the oldest entries to make room for the new one without exceeding
  // the cap. `slice(start)` is exclusive on the upper end so this preserves
  // referential equality of every surviving event.
  return [...prev.slice(prev.length - maxBuffered + 1), incoming];
}
