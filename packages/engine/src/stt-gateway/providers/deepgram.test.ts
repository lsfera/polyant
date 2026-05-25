// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deepgramAdapter } from "./deepgram.js";
import { STTProviderError, STTMissingCredentialsError } from "../errors.js";

describe("deepgramAdapter", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns a normalized transcript on success", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            channels: [
              {
                alternatives: [
                  { transcript: "ciao mondo", confidence: 0.97 },
                ],
                detected_language: "it",
              },
            ],
          },
          metadata: { duration: 3.5 },
        }),
        { status: 200 },
      ),
    );

    const result = await deepgramAdapter.transcribe({
      audio: Buffer.from([0x4f, 0x67, 0x67, 0x53]),
      mimeType: "audio/ogg",
      credentials: { deepgram: { apiKey: "dg-test" } },
    });

    expect(result.text).toBe("ciao mondo");
    expect(result.language).toBe("it");
    expect(result.confidence).toBeCloseTo(0.97);
    expect(result.durationSec).toBeCloseTo(3.5);
    expect(result.provider).toBe("deepgram");
    expect(result.model).toBe("nova-3");
  });

  it("throws STTMissingCredentialsError when credentials.deepgram is undefined", async () => {
    await expect(
      deepgramAdapter.transcribe({
        audio: Buffer.from([0]),
        mimeType: "audio/ogg",
        credentials: {},
      }),
    ).rejects.toBeInstanceOf(STTMissingCredentialsError);
  });

  it("throws STTProviderError on non-2xx response", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response("forbidden", { status: 403 }),
    );

    await expect(
      deepgramAdapter.transcribe({
        audio: Buffer.from([0]),
        mimeType: "audio/ogg",
        credentials: { deepgram: { apiKey: "dg-test" } },
      }),
    ).rejects.toBeInstanceOf(STTProviderError);
  });

  it("forwards languageHint as the language query param", async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: { channels: [{ alternatives: [{ transcript: "x" }] }] },
        }),
        { status: 200 },
      ),
    );

    await deepgramAdapter.transcribe({
      audio: Buffer.from([0]),
      mimeType: "audio/ogg",
      languageHint: "it",
      credentials: { deepgram: { apiKey: "dg-test" } },
    });

    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("language=it");
  });
});
