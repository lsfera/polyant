// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Emit a `category: "memory"` event when the memory extractor upserts a
 * batch of memories from a conversation. One event per batch — never one
 * per single memory (that would flood the panel).
 */

import type { FeedEvent, InstanceMeta } from "../activity-stream.types.js";
import { truncate } from "../event-formatters.js";
import { makeEventId, nowIso, safeEmit } from "../emit-helpers.js";

const PREVIEW_CHARS = 600;
const MAX_CATEGORIES_LABEL = 5;

export interface MemoryInput {
  count: number;
  categories: string[];
  /** First/representative memory text shown as the body preview. */
  firstMemoryText?: string;
  conversationId?: string;
  instance?: InstanceMeta;
}

export function emitMemory(input: MemoryInput): void {
  if (input.count <= 0) return; // nothing to surface
  const cats = uniqueSorted(input.categories).slice(0, MAX_CATEGORIES_LABEL);
  const catsLabel = cats.length > 0 ? cats.join(", ") : "—";
  const evt: FeedEvent = {
    id: makeEventId("memory", input.conversationId),
    ts: nowIso(),
    persona: "agent",
    category: "memory",
    text: `+${input.count} memorie · ${catsLabel}`,
    status: "success",
    responsePreview: input.firstMemoryText
      ? truncate(input.firstMemoryText, PREVIEW_CHARS)
      : undefined,
    conversationId: input.conversationId,
    instance: input.instance,
    memory: {
      count: input.count,
      categories: cats,
    },
  };
  safeEmit(evt);
}

function uniqueSorted(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((s): s is string => typeof s === "string" && s.length > 0))).sort();
}
