// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Parse and clamp pagination parameters from query strings.
 * Shared by all paginated controller endpoints.
 */
export function parsePagination(
  limitStr: string | undefined,
  offsetStr: string | undefined,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const { defaultLimit = 50, maxLimit = 200 } = opts;
  const limit = Math.min(Math.max(parseInt(limitStr ?? "", 10) || defaultLimit, 1), maxLimit);
  const offset = Math.max(parseInt(offsetStr ?? "", 10) || 0, 0);
  return { limit, offset };
}
