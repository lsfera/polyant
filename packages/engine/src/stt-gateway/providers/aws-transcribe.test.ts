// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STTMissingCredentialsError, STTUnsupportedFormatError } from "../errors.js";

const { sendMock, TranscribeClientMock, StartStreamTranscriptionCommandMock } = vi.hoisted(() => {
  const sendMock = vi.fn();
  const TranscribeClientMock = vi.fn().mockImplementation(function () {
    return { send: sendMock };
  });
  const StartStreamTranscriptionCommandMock = vi.fn();
  return { sendMock, TranscribeClientMock, StartStreamTranscriptionCommandMock };
});

vi.mock("@aws-sdk/client-transcribe-streaming", () => ({
  TranscribeStreamingClient: TranscribeClientMock,
  StartStreamTranscriptionCommand: StartStreamTranscriptionCommandMock,
}));

import { awsTranscribeAdapter } from "./aws-transcribe.js";

describe("awsTranscribeAdapter", () => {
  beforeEach(() => {
    sendMock.mockReset();
    TranscribeClientMock.mockClear();
    StartStreamTranscriptionCommandMock.mockClear();
  });

  it("throws STTMissingCredentialsError when credentials.aws is undefined", async () => {
    await expect(
      awsTranscribeAdapter.transcribe({
        audio: Buffer.from([0]),
        mimeType: "audio/ogg",
        credentials: {},
      }),
    ).rejects.toBeInstanceOf(STTMissingCredentialsError);
  });

  it("throws STTUnsupportedFormatError for non-Opus/PCM/Flac MIME", async () => {
    await expect(
      awsTranscribeAdapter.transcribe({
        audio: Buffer.from([0]),
        mimeType: "audio/mpeg",
        credentials: {
          aws: { accessKeyId: "AKIA", secretAccessKey: "x", region: "eu-west-1" },
        },
      }),
    ).rejects.toBeInstanceOf(STTUnsupportedFormatError);
  });

  it("aggregates non-partial Transcript events into a single text", async () => {
    sendMock.mockResolvedValueOnce({
      TranscriptResultStream: (async function* () {
        yield {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  IsPartial: true,
                  Alternatives: [{ Transcript: "ciao" }],
                },
              ],
            },
          },
        };
        yield {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  IsPartial: false,
                  Alternatives: [{ Transcript: "ciao mondo" }],
                  LanguageCode: "it-IT",
                },
              ],
            },
          },
        };
      })(),
    });

    const result = await awsTranscribeAdapter.transcribe({
      audio: Buffer.from([0x4f, 0x67, 0x67, 0x53]),
      mimeType: "audio/ogg",
      languageHint: "it",
      credentials: {
        aws: { accessKeyId: "AKIA", secretAccessKey: "x", region: "eu-west-1" },
      },
    });

    expect(result.text).toBe("ciao mondo");
    expect(result.language).toBe("it-IT");
    expect(result.provider).toBe("aws");
    expect(result.model).toBe("transcribe-streaming");

    // The SDK was constructed with our region + credentials
    expect(TranscribeClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "eu-west-1",
        credentials: { accessKeyId: "AKIA", secretAccessKey: "x" },
      }),
    );
    // The command got OGG-OPUS encoding
    expect(StartStreamTranscriptionCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        MediaEncoding: "ogg-opus",
        MediaSampleRateHertz: 16000,
        LanguageCode: "it-IT",
      }),
    );
  });
});
