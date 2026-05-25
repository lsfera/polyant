// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Emit `category: "agent-handoff"` events when one agent invokes another via
 * the synthesized `ask_<slug>` tool. A handoff is rendered as a single
 * dual-avatar row on the activity panel — start fires before the target
 * pipeline runs, end fires when the call resolves with success or error.
 *
 * Both events share the same `eventBaseId` so the UI can group them if
 * needed; for now the FE renders the most recent state of each id.
 */

import type { AgentHandoffMeta, FeedEvent, InstanceMeta } from "../activity-stream.types.js";
import { truncate } from "../event-formatters.js";
import { nowIso, safeEmit } from "../emit-helpers.js";

const PROMPT_PREVIEW_CHARS = 600;
const PROMPT_SUMMARY_CHARS = 80;
const RESULT_PREVIEW_CHARS = 600;

export interface HandoffStartInput {
  /** Shared id prefix between start and end so the UI can pair them. */
  eventBaseId: string;
  fromInstance: InstanceMeta;
  toInstance: InstanceMeta;
  toolName: string;
  prompt: string;
  callerConversationId: string;
  childConversationId?: string;
}

export interface HandoffEndInput extends HandoffStartInput {
  status: "success" | "error";
  durationMs: number;
  /** Tool return value preview (pre-truncated by caller is OK; we cap again). */
  resultPreview?: string;
}

function buildHandoffMeta(input: HandoffStartInput): AgentHandoffMeta {
  return {
    fromInstance: input.fromInstance,
    toInstance: input.toInstance,
    toolName: input.toolName,
    prompt: truncate(input.prompt, PROMPT_PREVIEW_CHARS),
    childConversationId: input.childConversationId,
  };
}

function compactText(toInstance: InstanceMeta, prompt: string): string {
  const trimmed = prompt.trim() || "(prompt vuoto)";
  return `→ ${toInstance.name}: ${truncate(trimmed, PROMPT_SUMMARY_CHARS)}`;
}

export function emitAgentHandoffStart(input: HandoffStartInput): void {
  const evt: FeedEvent = {
    id: `${input.eventBaseId}:start`,
    ts: nowIso(),
    persona: "agent",
    category: "agent-handoff",
    text: compactText(input.toInstance, input.prompt),
    instance: input.fromInstance,
    conversationId: input.callerConversationId,
    handoff: buildHandoffMeta(input),
  };
  safeEmit(evt);
}

export function emitAgentHandoffEnd(input: HandoffEndInput): void {
  const evt: FeedEvent = {
    id: `${input.eventBaseId}:end`,
    ts: nowIso(),
    persona: "agent",
    category: "agent-handoff",
    text: compactText(input.toInstance, input.prompt),
    instance: input.fromInstance,
    conversationId: input.callerConversationId,
    status: input.status,
    durationMs: input.durationMs,
    resultPreview: input.resultPreview
      ? truncate(input.resultPreview, RESULT_PREVIEW_CHARS)
      : undefined,
    handoff: buildHandoffMeta(input),
  };
  safeEmit(evt);
}
