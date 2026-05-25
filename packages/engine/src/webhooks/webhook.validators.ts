// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { CHANNEL_TYPES } from "../instances/channels.store.js";

export const createEventSourceSchema = z.object({
  name: z.string().min(1),
  sourceType: z.string().min(1),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().optional(),
});

export const updateEventSourceSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const createDefinitionSchema = z.object({
  name: z.string().min(1),
  matchingPrompt: z.string().min(1),
  interpretationPrompt: z.string().default(""),
  action: z.enum(["backlog", "conversation"]).default("backlog"),
  contextPrompt: z.string().min(1).optional(),
  outboundChannel: z.enum(CHANNEL_TYPES).optional(),
  outboundTarget: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.action === "conversation") {
      return !!data.contextPrompt && !!data.outboundChannel;
    }
    // backlog requires interpretationPrompt
    return !!data.interpretationPrompt;
  },
  { message: "action 'backlog' requires interpretationPrompt; action 'conversation' requires contextPrompt and outboundChannel" },
);

export const updateDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  matchingPrompt: z.string().min(1).optional(),
  interpretationPrompt: z.string().optional(),
  action: z.enum(["backlog", "conversation"]).optional(),
  contextPrompt: z.string().nullable().optional(),
  outboundChannel: z.enum(CHANNEL_TYPES).nullable().optional(),
  outboundTarget: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});
