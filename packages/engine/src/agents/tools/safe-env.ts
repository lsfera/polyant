// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Returns a filtered subset of process.env safe for subprocess propagation.
 *
 * Prevents leaking sensitive vars (DATABASE_URL, ENCRYPTION_KEY, AUTH_SECRET, etc.)
 * to child processes that only need PATH, locale, and tool-specific tokens.
 */

const SAFE_ENV_KEYS: ReadonlySet<string> = new Set([
  // System essentials
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "TMPDIR",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  // Node.js
  "NODE_ENV",
  "NODE_OPTIONS",
  "NODE_EXTRA_CA_CERTS",
  // TLS / proxy (corporate environments)
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]);

/**
 * Build a clean env object for subprocess spawning.
 *
 * @param extra - additional key-value pairs to merge (e.g. GH_TOKEN, ANTHROPIC_API_KEY)
 * @returns filtered env — only safe system vars + explicit extras
 */
export function safeEnv(extra?: Record<string, string | undefined>): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of SAFE_ENV_KEYS) {
    // CONVENTION-EXCEPTION: reads process.env intentionally to filter the subset
    // to propagate into subprocess env (explicit key registry). See CLAUDE.md.
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  if (extra) {
    Object.assign(env, extra);
  }
  return env;
}
