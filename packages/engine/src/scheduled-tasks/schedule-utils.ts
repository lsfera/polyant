// SPDX-License-Identifier: AGPL-3.0-or-later

import { Cron } from "croner";
import type { ScheduleConfig } from "./schema.js";

/**
 * Compute the next run time for a schedule configuration.
 * Returns null if the schedule has no future runs (e.g. expired one-shot).
 */
export function computeNextRun(schedule: ScheduleConfig, lastRunAt?: Date): Date | null {
  const now = new Date();

  switch (schedule.type) {
    case "cron": {
      const job = new Cron(schedule.expression, {
        timezone: schedule.timezone,
      });
      const next = job.nextRun();
      return next;
    }

    case "interval": {
      const anchor = schedule.anchorAt ? new Date(schedule.anchorAt) : (lastRunAt ?? now);
      let next = new Date(anchor.getTime() + schedule.everyMs);
      // Advance to the future if next is in the past
      while (next.getTime() <= now.getTime()) {
        next = new Date(next.getTime() + schedule.everyMs);
      }
      return next;
    }

    case "one-shot": {
      const runAt = new Date(schedule.runAt);
      return runAt.getTime() > now.getTime() ? runAt : null;
    }
  }
}

/**
 * Parse a relative duration string ("+20m", "+1h", "+2d") into an absolute Date.
 * Supports: s (seconds), m (minutes), h (hours), d (days).
 */
export function parseRelativeDuration(str: string): Date {
  const match = str.match(/^\+(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid relative duration: "${str}". Expected format: +<number><s|m|h|d>`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}

/**
 * Format a schedule config into a human-readable string for display.
 */
export function formatScheduleHuman(schedule: ScheduleConfig): string {
  switch (schedule.type) {
    case "cron": {
      return schedule.expression;
    }
    case "interval": {
      const ms = schedule.everyMs;
      if (ms >= 86_400_000) return `Every ${Math.round(ms / 86_400_000)}d`;
      if (ms >= 3_600_000) return `Every ${Math.round(ms / 3_600_000)}h`;
      if (ms >= 60_000) return `Every ${Math.round(ms / 60_000)}m`;
      return `Every ${Math.round(ms / 1_000)}s`;
    }
    case "one-shot": {
      return `Once at ${new Date(schedule.runAt).toISOString()}`;
    }
  }
}

/** Backoff schedule for retries (30s, 1m, 5m) */
export const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 300_000];

/** Max consecutive errors before auto-disable */
export const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Compute the next retry time based on consecutive error count.
 */
export function computeRetryDelay(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[idx];
}
