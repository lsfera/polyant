// SPDX-License-Identifier: AGPL-3.0-or-later

/** Shared chart colors for analytics components. */

/** Series palette used when colour per row is cycled (tool usage, tool latency). */
export const CHART_PALETTE = [
  "#000000",   // black
  "#F16034",   // accent orange
  "#6366f1",   // indigo
  "#10b981",   // emerald
  "#f59e0b",   // amber
  "#8b5cf6",   // violet
  "#ec4899",   // pink
  "#06b6d4",   // cyan
  "#84cc16",   // lime
  "#ef4444",   // red
] as const;

/** Per-phase colours used by the pipeline phase-breakdown chart. */
export const PHASE_COLORS = {
  contextPrep: "#6366f1",
  toolBuilding: "#10b981",
  llmCall: "#000000",
} as const;

/** Latency percentile colours (p50/p95/p99). */
export const PERCENTILE_COLORS = {
  p50: "#000000",
  p95: "#F16034",
  p99: "#6366f1",
} as const;
