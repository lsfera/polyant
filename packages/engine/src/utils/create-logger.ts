// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared logger factory for colored, timestamped console output.
 * Used by pipeline-logger, room-logger, webhook-logger, etc.
 */

export const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
} as const;

/** Formatted timestamp for log lines (HH:MM:SS, 24-hour). */
export function ts(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

export interface Logger {
  info(prefix: string, msg: string): void;
  warn(prefix: string, msg: string): void;
  error(prefix: string, msg: string, err?: unknown): void;
}

/**
 * Create a structured logger with colored, timestamped output.
 * The `defaultColor` is used for info-level messages.
 */
export function createLogger(defaultColor: string = COLORS.cyan): Logger {
  function fmt(level: "info" | "warn" | "error", prefix: string, msg: string): string {
    const color = level === "error" ? COLORS.red : level === "warn" ? COLORS.yellow : defaultColor;
    return `${COLORS.dim}${ts()}${COLORS.reset} ${color}[${prefix}]${COLORS.reset} ${msg}`;
  }

  return {
    info(prefix: string, msg: string): void {
      process.stdout.write(fmt("info", prefix, msg) + "\n");
    },
    warn(prefix: string, msg: string): void {
      process.stderr.write(fmt("warn", prefix, msg) + "\n");
    },
    error(prefix: string, msg: string, err?: unknown): void {
      const errMsg = err instanceof Error ? err.message : String(err ?? "");
      const full = errMsg ? `${msg} — ${errMsg}` : msg;
      process.stderr.write(fmt("error", prefix, full) + "\n");
    },
  };
}
