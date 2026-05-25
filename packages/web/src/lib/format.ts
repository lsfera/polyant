// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TranslationKey } from "@/lib/i18n/types";

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

/**
 * Parse a date string as UTC. PostgreSQL timestamp columns without timezone
 * return strings like "2026-04-03T07:45:46.000" (no Z suffix). JavaScript
 * treats these as local time, causing wrong display. This helper appends "Z"
 * when no timezone indicator is present, so the browser correctly converts
 * from UTC to the user's local timezone.
 */
export function parseUTC(dateStr: string): Date {
  if (/[Z+\-]\d{0,4}:?\d{0,2}$/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr + "Z");
}

export function formatRelativeTime(dateStr: string | null, t: TranslateFn): string {
  if (!dateStr) return "\u2014";
  const date = parseUTC(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t("instances.time.justNow");
  if (diffMins < 60) return t("instances.time.minutesAgo", { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t("instances.time.hoursAgo", { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t("instances.time.daysAgo", { count: diffDays });
  return date.toLocaleDateString();
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  try {
    return parseUTC(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  try {
    return parseUTC(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
