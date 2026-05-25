// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Emit a `category: "conversation"` event when a conversation is first
 * created or archived. Lifecycle-only: messages within an existing
 * conversation are NOT surfaced here (that's the inbound/outbound stream).
 */

import type {
  ConversationLifecycleMeta,
  FeedEvent,
  InstanceMeta,
} from "../activity-stream.types.js";
import { makeEventId, nowIso, safeEmit } from "../emit-helpers.js";

export interface ConversationInput {
  conversationId: string;
  lifecycle: ConversationLifecycleMeta["lifecycle"];
  source?: string;       // "user" | "room" | "webhook" | "scheduled"
  channel?: string;
  instance?: InstanceMeta;
}

export function emitConversation(input: ConversationInput): void {
  const verb = input.lifecycle === "created" ? "nuova conversazione" : "conversazione archiviata";
  const tail = [input.source, input.channel].filter(Boolean).join(" · ");
  const evt: FeedEvent = {
    id: makeEventId("conversation", input.conversationId),
    ts: nowIso(),
    persona: "agent",
    category: "conversation",
    text: tail ? `${verb} · ${tail}` : verb,
    status: "success",
    conversationId: input.conversationId,
    instance: input.instance,
    conversation: {
      lifecycle: input.lifecycle,
      source: input.source,
      channel: input.channel,
    },
  };
  safeEmit(evt);
}
