// SPDX-License-Identifier: AGPL-3.0-or-later

import { createAnthropic } from "@ai-sdk/anthropic";
import { createProvider } from "./base.js";

export const AnthropicProvider = createProvider("anthropic", (modelId, apiKeys) => {
  const apiKey = apiKeys?.anthropic;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured for this instance. Set it in the admin panel under Settings → AI Provider API Keys.");
  }
  return createAnthropic({ apiKey })(modelId);
});
