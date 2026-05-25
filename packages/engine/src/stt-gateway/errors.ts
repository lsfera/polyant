// SPDX-License-Identifier: AGPL-3.0-or-later

export class STTError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "STTError";
  }
}

export class STTTimeoutError extends STTError {
  constructor(provider: string, timeoutMs: number) {
    super(`STT provider "${provider}" timed out after ${timeoutMs}ms`);
    this.name = "STTTimeoutError";
  }
}

export class STTProviderError extends STTError {
  readonly status?: number;
  constructor(provider: string, message: string, options?: { cause?: unknown; status?: number }) {
    super(`STT provider "${provider}": ${message}`, options);
    this.name = "STTProviderError";
    this.status = options?.status;
  }
}

export class STTUnsupportedFormatError extends STTError {
  constructor(provider: string, mimeType: string) {
    super(`STT provider "${provider}" does not accept format "${mimeType}"`);
    this.name = "STTUnsupportedFormatError";
  }
}

export class STTMissingCredentialsError extends STTError {
  constructor(provider: string) {
    super(`STT provider "${provider}" is selected but its credentials are missing`);
    this.name = "STTMissingCredentialsError";
  }
}

export class STTEmptyTranscriptError extends STTError {
  constructor(provider: string) {
    super(`STT provider "${provider}" returned an empty transcript`);
    this.name = "STTEmptyTranscriptError";
  }
}
