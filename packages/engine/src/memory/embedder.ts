// SPDX-License-Identifier: AGPL-3.0-or-later

import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

const providerCache = new Map<string, ReturnType<typeof createOpenAI>>();
function getOpenAIProvider(apiKey: string) {
  const cached = providerCache.get(apiKey);
  if (cached) return cached;
  const provider = createOpenAI({ apiKey });
  providerCache.set(apiKey, provider);
  return provider;
}

/**
 * Generate a single embedding vector.
 * Always uses OpenAI (Anthropic has no embedding API).
 * Requires an explicit apiKey from per-instance secrets.
 */
export async function generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error("OpenAI API key required for embeddings. Set it in the admin panel under Settings → AI Provider API Keys.");
  }
  const { embedding } = await embed({
    model: getOpenAIProvider(apiKey).embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey?: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) {
    const single = await generateEmbedding(texts[0], apiKey);
    return [single];
  }
  if (!apiKey) {
    throw new Error("OpenAI API key required for embeddings. Set it in the admin panel under Settings → AI Provider API Keys.");
  }
  const { embeddings } = await embedMany({
    model: getOpenAIProvider(apiKey).embedding(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
