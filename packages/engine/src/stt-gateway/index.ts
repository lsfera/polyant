// SPDX-License-Identifier: AGPL-3.0-or-later

import { resolveSTTProvider } from "./factory.js";
import type { STTProviderName, STTRequest, STTResponse } from "./types.js";

export async function transcribe(
  provider: STTProviderName,
  request: STTRequest,
): Promise<STTResponse> {
  const adapter = resolveSTTProvider(provider);
  return adapter.transcribe(request);
}

export type {
  STTProviderName,
  STTRequest,
  STTResponse,
  STTCredentials,
  STTProviderAdapter,
} from "./types.js";

export {
  STTError,
  STTTimeoutError,
  STTProviderError,
  STTUnsupportedFormatError,
  STTMissingCredentialsError,
  STTEmptyTranscriptError,
} from "./errors.js";

export { registerSTTProvider } from "./factory.js";
