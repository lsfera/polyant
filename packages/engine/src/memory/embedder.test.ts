// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));

const mockEmbeddingFn = vi.fn(() => "mock-embedding-model");
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    embedding: mockEmbeddingFn,
  })),
}));

import { generateEmbedding, generateEmbeddings } from "./embedder.js";
import { embed, embedMany } from "ai";

const mockEmbed = vi.mocked(embed);
const mockEmbedMany = vi.mocked(embedMany);

const TEST_API_KEY = "test-openai-key";

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a single embedding", async () => {
    mockEmbed.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    } as any);

    const result = await generateEmbedding("hello world", TEST_API_KEY);

    expect(mockEmbed).toHaveBeenCalledWith({
      model: "mock-embedding-model",
      value: "hello world",
    });
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("throws when no apiKey provided", async () => {
    await expect(generateEmbedding("hello")).rejects.toThrow("OpenAI API key required");
  });
});

describe("generateEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates batch embeddings", async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    } as any);

    const result = await generateEmbeddings(["text one", "text two"], TEST_API_KEY);

    expect(mockEmbedMany).toHaveBeenCalledWith({
      model: "mock-embedding-model",
      values: ["text one", "text two"],
    });
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("returns empty array for empty input", async () => {
    const result = await generateEmbeddings([]);

    expect(result).toEqual([]);
    expect(mockEmbed).not.toHaveBeenCalled();
    expect(mockEmbedMany).not.toHaveBeenCalled();
  });

  it("uses single embed for one-element array", async () => {
    mockEmbed.mockResolvedValue({
      embedding: [0.5, 0.6],
    } as any);

    const result = await generateEmbeddings(["only one"], TEST_API_KEY);

    expect(mockEmbed).toHaveBeenCalledWith({
      model: "mock-embedding-model",
      value: "only one",
    });
    expect(mockEmbedMany).not.toHaveBeenCalled();
    expect(result).toEqual([[0.5, 0.6]]);
  });

  it("throws when no apiKey provided for multiple texts", async () => {
    await expect(generateEmbeddings(["a", "b"])).rejects.toThrow("OpenAI API key required");
  });
});
