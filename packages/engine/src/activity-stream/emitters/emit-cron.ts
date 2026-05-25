// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Emit a `category: "cron"` event when a scheduled task fires (right
 * before the message handler runs, not after completion — we want the
 * "something is starting now" signal to land on the panel immediately).
 */

import type { FeedEvent, InstanceMeta } from "../activity-stream.types.js";
import { truncate } from "../event-formatters.js";
import { makeEventId, nowIso, safeEmit } from "../emit-helpers.js";

const PREVIEW_CHARS = 600;

export interface CronInput {
  taskName: string;
  schedule: string;          // cron expression / interval / one-shot human-readable
  prompt?: string;           // task.prompt — may contain detailed instructions
  runId?: string;
  triggerType?: string;      // "scheduled" | "manual"
  conversationId?: string;
  instance?: InstanceMeta;
}

export function emitCron(input: CronInput): void {
  const evt: FeedEvent = {
    id: makeEventId("cron", input.runId ?? input.taskName),
    ts: nowIso(),
    persona: "agent",
    category: "cron",
    text: `cron: ${input.taskName}`,
    status: "success",
    responsePreview: input.prompt ? truncate(input.prompt, PREVIEW_CHARS) : undefined,
    conversationId: input.conversationId,
    instance: input.instance,
    cron: {
      name: input.taskName,
      schedule: input.schedule,
      runId: input.runId,
      triggerType: input.triggerType,
    },
  };
  safeEmit(evt);
}
