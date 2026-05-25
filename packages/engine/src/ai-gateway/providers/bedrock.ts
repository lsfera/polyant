// SPDX-License-Identifier: AGPL-3.0-or-later

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createProvider } from "./base.js";

export const BedrockProvider = createProvider("bedrock", (modelId, apiKeys) => {
  const accessKeyId = apiKeys?.bedrock_access_key_id;
  const secretAccessKey = apiKeys?.bedrock_secret_access_key;
  const region = apiKeys?.bedrock_region ?? "us-east-1";

  // When per-instance credentials are provided, use them explicitly.
  // Otherwise the SDK falls back to AWS env vars / shared credentials (~/.aws/credentials) / IAM role.
  return createAmazonBedrock({
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
    region,
  })(modelId);
});
