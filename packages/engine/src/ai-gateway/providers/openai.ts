// SPDX-License-Identifier: AGPL-3.0-or-later

import { createOpenAI } from "@ai-sdk/openai";
import { createProvider } from "./base.js";

export const OpenAIProvider = createProvider("openai", (modelId, apiKeys) => {
  const apiKey = apiKeys?.openai;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured for this instance. Set it in the admin panel under Settings → AI Provider API Keys.");
  }
  return createOpenAI({ apiKey, compatibility: "strict" })(modelId, {
    // Disable structuredOutputs for reasoning models (gpt-5*).
    // The SDK defaults structuredOutputs=true for reasoning models, which adds
    // strict:true to tool schemas — requiring ALL properties in `required`.
    // Our tools use Zod .nullish()/.optional() extensively, producing schemas
    // incompatible with OpenAI's strict mode. Disabling this lets the API
    // validate schemas normally while keeping full tool-use support.
    structuredOutputs: false,
  });
});
