// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioStream,
  type LanguageCode,
} from "@aws-sdk/client-transcribe-streaming";

import type { STTProviderAdapter, STTRequest, STTResponse } from "../types.js";
import {
  STTMissingCredentialsError,
  STTProviderError,
  STTUnsupportedFormatError,
} from "../errors.js";

const CHUNK_SIZE = 16 * 1024;
const SAMPLE_RATE_HZ = 16_000;

/** Map an inbound MIME type to AWS Transcribe MediaEncoding (or null when unsupported). */
function mediaEncodingFor(mimeType: string): "ogg-opus" | "pcm" | "flac" | null {
  const m = mimeType.toLowerCase();
  if (m === "audio/ogg" || m.startsWith("audio/ogg;") || m === "audio/opus") return "ogg-opus";
  if (m === "audio/flac" || m === "audio/x-flac") return "flac";
  if (m === "audio/wav" || m === "audio/x-wav" || m === "audio/pcm") return "pcm";
  return null;
}

/** Map a 2-letter language hint into the BCP-47 codes Transcribe accepts. Limited set; defaults are safe. */
function languageCodeFor(hint?: string): LanguageCode | undefined {
  if (!hint) return undefined;
  const h = hint.toLowerCase();
  const map: Record<string, LanguageCode> = {
    it: "it-IT",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    de: "de-DE",
    pt: "pt-PT",
  };
  return map[h] ?? undefined;
}

async function* chunkAudio(buffer: Buffer): AsyncIterable<AudioStream> {
  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    yield { AudioEvent: { AudioChunk: buffer.subarray(i, i + CHUNK_SIZE) } };
  }
}

async function transcribe(req: STTRequest): Promise<STTResponse> {
  const cred = req.credentials.aws;
  if (!cred?.accessKeyId || !cred.secretAccessKey || !cred.region) {
    throw new STTMissingCredentialsError("aws");
  }

  const encoding = mediaEncodingFor(req.mimeType);
  if (!encoding) throw new STTUnsupportedFormatError("aws", req.mimeType);

  const client = new TranscribeStreamingClient({
    region: cred.region,
    credentials: {
      accessKeyId: cred.accessKeyId,
      secretAccessKey: cred.secretAccessKey,
    },
  });

  const languageCode = languageCodeFor(req.languageHint);

  const command = new StartStreamTranscriptionCommand({
    MediaEncoding: encoding,
    MediaSampleRateHertz: SAMPLE_RATE_HZ,
    LanguageCode: languageCode,
    IdentifyLanguage: languageCode ? undefined : true,
    AudioStream: chunkAudio(req.audio),
  });

  const start = Date.now();
  let response;
  try {
    response = await client.send(command);
  } catch (err) {
    throw new STTProviderError("aws", `send failed: ${(err as Error).message}`, { cause: err });
  }

  let finalText = "";
  let detectedLanguage: string | undefined;

  try {
    for await (const event of response.TranscriptResultStream ?? []) {
      const results = event.TranscriptEvent?.Transcript?.Results ?? [];
      for (const r of results) {
        if (r.IsPartial) continue;
        const alt = r.Alternatives?.[0]?.Transcript;
        if (alt) finalText += (finalText ? " " : "") + alt;
        if (r.LanguageCode) detectedLanguage = r.LanguageCode;
      }
    }
  } catch (err) {
    throw new STTProviderError("aws", `stream error: ${(err as Error).message}`, { cause: err });
  }

  return {
    text: finalText.trim(),
    language: detectedLanguage,
    provider: "aws",
    model: "transcribe-streaming",
    latencyMs: Date.now() - start,
  };
}

export const awsTranscribeAdapter: STTProviderAdapter = {
  name: "aws",
  transcribe,
};
