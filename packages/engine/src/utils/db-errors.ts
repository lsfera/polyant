// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Database error helpers.
 *
 * Drizzle 0.45 (postgres-js driver) wraps the underlying `PostgresError` inside
 * a `DrizzleQueryError`. The driver-level error — which carries the SQLSTATE
 * `code` (e.g. "23505" for unique violation) — ends up on `err.cause`, not on
 * `err` itself. We therefore have to inspect BOTH levels.
 */

const UNIQUE_VIOLATION_CODE = "23505";

function hasCode(value: unknown, code: string): boolean {
  return (
    value != null &&
    typeof value === "object" &&
    "code" in value &&
    (value as { code: unknown }).code === code
  );
}

/** Detect a PostgreSQL unique constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (hasCode(err, UNIQUE_VIOLATION_CODE)) return true;
  // postgres-js wraps the underlying PostgresError on .cause
  const cause = (err as Error & { cause?: unknown }).cause;
  if (hasCode(cause, UNIQUE_VIOLATION_CODE)) return true;
  return false;
}
