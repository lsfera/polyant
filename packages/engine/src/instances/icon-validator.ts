// SPDX-License-Identifier: AGPL-3.0-or-later

import { BadRequestException } from "@nestjs/common";

const MAX_DECODED_BYTES = 100 * 1024; // 100 KB

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

/**
 * Validate a base64 data URI for an instance icon.
 * Checks format, MIME type, decoded size, and magic bytes.
 * Throws BadRequestException on failure.
 */
export function validateIconDataUri(dataUri: string): void {
  const match = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) {
    throw new BadRequestException("Invalid data URI format. Expected data:image/<type>;base64,...");
  }

  const mimeType = match[1];
  const base64Data = match[2];

  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new BadRequestException(`Unsupported image type "${mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.byteLength > MAX_DECODED_BYTES) {
    throw new BadRequestException(`Icon too large (${Math.round(buffer.byteLength / 1024)}KB). Maximum: ${MAX_DECODED_BYTES / 1024}KB`);
  }

  const expected = MAGIC_BYTES[mimeType];
  if (expected) {
    const headerMatch = expected.every((byte, i) => buffer[i] === byte);
    if (!headerMatch) {
      throw new BadRequestException("File content does not match declared MIME type");
    }
  }
}
