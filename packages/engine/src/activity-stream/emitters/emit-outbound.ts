// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Emit a `category: "outbound"` event when the agent sends a message
 * back through a channel adapter (Telegram, WhatsApp, Slack, …).
 */

import type { FeedEvent, InstanceMeta } from "../activity-stream.types.js";
import { truncate } from "../event-formatters.js";
import { makeEventId, nowIso, safeEmit } from "../emit-helpers.js";

const SUMMARY_CHARS = 80;
const PREVIEW_CHARS = 600;

export interface OutboundInput {
  channelType: string;
  channelId: string;
  text: string;
  /** Whether the adapter delivered the message successfully. */
  ok: boolean;
  /** Optional error message when `ok === false`. */
  error?: string;
  conversationId?: string;
  instance?: InstanceMeta;
}

export function emitOutbound(input: OutboundInput): void {
  const trimmed = (input.text ?? "").trim();
  const summary = trimmed.length > 0 ? trimmed : "(nessun testo)";
  const evt: FeedEvent = {
    id: makeEventId("outbound", input.conversationId),
    ts: nowIso(),
    persona: "agent",
    category: "outbound",
    text: `${input.channelType}: ${truncate(summary, SUMMARY_CHARS)}`,
    status: input.ok ? "success" : "error",
    responsePreview: input.ok
      ? trimmed
        ? truncate(trimmed, PREVIEW_CHARS)
        : undefined
      : truncate(input.error ?? "send failed", PREVIEW_CHARS),
    conversationId: input.conversationId,
    instance: input.instance,
    channel: {
      type: input.channelType,
      id: input.channelId,
    },
  };
  safeEmit(evt);
}
