// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Engine pg-boss worker for the `room-cycle` queue.
 *
 * The engine process is both a producer (it enqueues trigger jobs from the
 * message pipeline) and a consumer (this worker drains the queue). On each
 * received job it resolves the room and instance slug from the job's
 * `instanceId`, then runs one room cycle via `executeRoomCycle`.
 *
 * Two `singletonKey` namespaces coexist on this queue:
 *   - `instanceId`           → tick jobs (scheduler.ts, priority 0)
 *   - `trigger:${instanceId}` → trigger jobs (message pipeline, priority 10)
 * Both resolve to the same dispatch path here.
 *
 * This module also owns the daily housekeeping loop (activity-log compaction +
 * analytics retention). Housekeeping is idempotent, so running it on every
 * engine replica is safe — no leader election is required.
 */

import type { Job } from "pg-boss";
import { getRoomByInstanceId, listEnabledRooms } from "./room.store.js";
import { resolveInstanceSlug } from "../instances/resolve-instance-id.js";
import { executeRoomCycle } from "./room-engine.js";
import { compactActivityLog } from "./activity-log.store.js";
import { runAnalyticsCleanup } from "../analytics/cleanup.js";
import { roomLog } from "./room-logger.js";
import { boss, startBoss, stopBoss } from "../scheduler/pg-boss-client.js";
import { ensureRoomCycleQueue, ROOM_CYCLE_QUEUE } from "./room-queue.js";
import { config } from "../config.js";

/** How often the daily housekeeping pass runs. */
const HOUSEKEEPING_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Payload of a `room-cycle` job. `instanceSlug` is present on tick jobs; */
/** `humanMessage` is present on trigger jobs. Only `instanceId` is required. */
export interface RoomCycleJobData {
  instanceId: string;
  instanceSlug?: string;
  humanMessage?: string;
}

/**
 * Seam 2 — dispatch a single `room-cycle` job to `executeRoomCycle`.
 *
 * Resolves the room and the (authoritative) instance slug from the job's
 * `instanceId`, then runs one room cycle. A `humanMessage` (trigger jobs) is
 * forwarded; tick jobs omit it. Errors are caught and logged so a failing
 * cycle never rejects the worker handler and triggers a pg-boss retry storm.
 */
export async function dispatchRoomCycleJob(job: Job<RoomCycleJobData>): Promise<void> {
  const { instanceId, humanMessage } = job.data;
  try {
    const room = await getRoomByInstanceId(instanceId);
    if (!room) {
      roomLog.warn("RoomWorker", `no room for instance ${instanceId}, skipping job`);
      return;
    }

    const slug = await resolveInstanceSlug(instanceId);
    if (!slug) {
      roomLog.warn("RoomWorker", `no slug for instance ${instanceId}, skipping job`);
      return;
    }

    await executeRoomCycle(room, slug, humanMessage);
  } catch (err) {
    // Swallow + log: a thrown handler would make pg-boss retry the job, which
    // for an LLM-driven cycle risks double execution. See #94.
    roomLog.error("RoomWorker", `room cycle failed for instance ${instanceId}`, err);
  }
}

/**
 * Run one housekeeping pass: compact every enabled room's activity log and
 * purge expired analytics rows. Idempotent and fire-and-forget per concern.
 */
export async function runHousekeeping(): Promise<void> {
  const rooms = await listEnabledRooms();

  for (const room of rooms) {
    compactActivityLog(room.instanceId).catch((err) =>
      roomLog.error("RoomWorker", `compaction error ${room.instanceId}`, err),
    );
  }

  runAnalyticsCleanup(config.analytics.retentionDays)
    .then((result) => {
      roomLog.info(
        "RoomWorker",
        `analytics cleanup: deleted ${result.aiLogsDeleted} ai_logs + ${result.pipelineTracesDeleted} pipeline_traces older than ${result.cutoff.toISOString()}`,
      );
    })
    .catch((err) => roomLog.error("RoomWorker", "analytics cleanup failed", err));
}

/**
 * Boot the engine's room worker: start the shared pg-boss client, ensure the
 * `room-cycle` queue exists, subscribe a worker, and start the daily
 * housekeeping loop. Returns a stop function that unsubscribes, clears the
 * housekeeping timer, and stops pg-boss.
 */
export async function startRoomWorker(): Promise<() => Promise<void>> {
  await startBoss();
  await ensureRoomCycleQueue(boss);

  await boss.work<RoomCycleJobData>(ROOM_CYCLE_QUEUE, async (jobs) => {
    // pg-boss v12 delivers a batch of jobs; process them sequentially.
    for (const job of jobs) {
      await dispatchRoomCycleJob(job);
    }
  });

  // Daily housekeeping — runs immediately, then every 24h. Idempotent.
  runHousekeeping().catch((err) => roomLog.error("RoomWorker", "housekeeping failed", err));
  const housekeepingTimer = setInterval(() => {
    runHousekeeping().catch((err) => roomLog.error("RoomWorker", "housekeeping failed", err));
  }, HOUSEKEEPING_INTERVAL_MS);

  roomLog.info("RoomWorker", "engine room worker subscribed to room-cycle queue");

  return async () => {
    clearInterval(housekeepingTimer);
    await boss.offWork(ROOM_CYCLE_QUEUE);
    await stopBoss();
    roomLog.info("RoomWorker", "engine room worker stopped");
  };
}
