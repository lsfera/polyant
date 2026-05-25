// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Daily housekeeping for analytics tables.
 *
 * Both `ai_logs` and `pipeline_traces` grow unboundedly — one row per LLM call
 * and one row per pipeline run respectively. Without a retention policy these
 * tables quickly become the largest in the database and slow down analytics
 * queries.
 *
 * This module exposes pure functions (no scheduling, no side-state) that delete
 * rows older than the configured retention window. They are wired into the
 * existing daily housekeeping branch of `RoomScheduler` so we don't introduce
 * yet another timer.
 */

import { lt } from "drizzle-orm";
import { db } from "../database/client.js";
import { aiLogs } from "../ai-gateway/logger.js";
import { pipelineTraces } from "./traces.schema.js";

export interface AnalyticsCleanupResult {
  aiLogsDeleted: number;
  pipelineTracesDeleted: number;
  cutoff: Date;
}

/** Compute the cutoff date (now - retentionDays). */
export function computeCutoff(retentionDays: number, now: Date = new Date()): Date {
  const ms = retentionDays * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

/** Delete `ai_logs` rows older than `cutoff`. Returns the number of rows removed. */
export async function deleteOldAiLogs(cutoff: Date): Promise<number> {
  const rows = await db
    .delete(aiLogs)
    .where(lt(aiLogs.createdAt, cutoff))
    .returning({ id: aiLogs.id });
  return rows.length;
}

/** Delete `pipeline_traces` rows older than `cutoff`. Returns the number of rows removed. */
export async function deleteOldPipelineTraces(cutoff: Date): Promise<number> {
  const rows = await db
    .delete(pipelineTraces)
    .where(lt(pipelineTraces.createdAt, cutoff))
    .returning({ id: pipelineTraces.id });
  return rows.length;
}

/** Run a full analytics cleanup pass. Safe to call multiple times (idempotent). */
export async function runAnalyticsCleanup(retentionDays: number): Promise<AnalyticsCleanupResult> {
  const cutoff = computeCutoff(retentionDays);
  const [aiLogsDeleted, pipelineTracesDeleted] = await Promise.all([
    deleteOldAiLogs(cutoff),
    deleteOldPipelineTraces(cutoff),
  ]);
  return { aiLogsDeleted, pipelineTracesDeleted, cutoff };
}
