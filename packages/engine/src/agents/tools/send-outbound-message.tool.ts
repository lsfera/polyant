// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { registerTool } from "./registry.js";
import { channelManager } from "../../channels/channel-manager.js";
import { getTriggerContext } from "../../webhooks/trigger-context.js";

registerTool({
  name: "send_outbound_message",
  description:
    "Send a message to the user via the configured outbound channel.\n" +
    "Use this tool to send the initial message or follow-up messages in a webhook-triggered conversation.\n" +
    "The outbound channel and target are determined by the trigger configuration.\n" +
    "Returns confirmation that the message was sent.\n" +
    "Caveat: only available in webhook-triggered conversation context. Message is plain text.",
  category: "conversation-trigger",
  harness: true,
  create: (ctx) => ({
    parameters: z.object({
      message: z.string().describe("The message to send to the user"),
    }),
    execute: async ({ message }) => {
      const triggerCtx = getTriggerContext(ctx.conversationId ?? "");
      if (!triggerCtx) {
        return { error: "No active trigger context. This tool is only available in webhook-triggered conversations." };
      }

      try {
        await channelManager.sendOutbound(
          triggerCtx.instanceSlug,
          triggerCtx.outboundChannel,
          triggerCtx.outboundTarget,
          message,
        );
      } catch (err) {
        return { error: `Failed to send outbound message: ${err instanceof Error ? err.message : String(err)}` };
      }

      return {
        success: true,
        replyHandled: true,
        replyText: message,
        channel: triggerCtx.outboundChannel,
        target: triggerCtx.outboundTarget,
      };
    },
  }),
});
