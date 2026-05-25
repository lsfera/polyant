// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared HTTP utilities used by http-request and curl tools.
 * Centralizes SSRF protection, body truncation, and header picking.
 */

import { assertSafeUrl, pinnedLookup } from "./url-safety.js";

/**
 * Validate URL for SSRF and return an undici Agent with pinned DNS lookup.
 * Callers pass the returned dispatcher to fetch() to prevent DNS rebinding.
 */
export async function createSafeDispatcher(url: URL): Promise<{ dispatcher: unknown }> {
  const resolved = await assertSafeUrl(url);
  const { Agent } = await import("undici");
  const dispatcher = new Agent({
    connect: { lookup: pinnedLookup(resolved) as never },
  });
  return { dispatcher };
}

/**
 * Truncate a response body to a maximum number of characters.
 */
export function truncateBody(
  text: string,
  maxChars: number,
): { body: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { body: text, truncated: false };
  }
  return { body: text.slice(0, maxChars), truncated: true };
}

/**
 * Pick a subset of response headers by name (case-insensitive matching via Headers API).
 */
export function pickHeaders(
  headers: Headers,
  interesting: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of interesting) {
    const value = headers.get(name);
    if (value) result[name] = value;
  }
  return result;
}
