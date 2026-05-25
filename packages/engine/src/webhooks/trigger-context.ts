// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Module-scoped context for the currently executing webhook-triggered conversation.
 * Set by webhook-engine before calling supervise(), read by the send_outbound_message tool.
 *
 * This uses a Map keyed by conversationId to support concurrent triggers.
 */

export interface TriggerContext {
  instanceSlug: string;
  outboundChannel: string;
  outboundTarget: string;
}

const activeContexts = new Map<string, TriggerContext>();

export function setTriggerContext(conversationId: string, ctx: TriggerContext): void {
  activeContexts.set(conversationId, ctx);
}

export function getTriggerContext(conversationId: string): TriggerContext | null {
  return activeContexts.get(conversationId) ?? null;
}

export function clearTriggerContext(conversationId: string): void {
  activeContexts.delete(conversationId);
}
