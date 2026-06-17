// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * pg-boss tick-based scheduler entrypoint.
 *
 * Boots the shared pg-boss client and runs a tick loop. On each tick it queries
 * the enabled rooms and the pending-event counts, then enqueues a `room-cycle`
 * job for every room that has pending events. Job-level `singletonKey`
 * deduplication (keyed by instance id) means multiple scheduler processes can
 * run concurrently without any leader election — pg-boss collapses duplicate
 * jobs for the same instance.
 */

import type { PgBoss } from "pg-boss";
import { listEnabledRooms } from "./room/room.store.js";
import { countPendingByInstance } from "./webhooks/webhook-backlog.store.js";
import { resolveInstanceSlug } from "./instances/resolve-instance-id.js";
import { roomLog } from "./room/room-logger.js";
import { boss, startBoss, stopBoss } from "./scheduler/pg-boss-client.js";
import { config } from "./config.js";

/** Name of the queue that carries one job per due room cycle. */
export const ROOM_CYCLE_QUEUE = "room-cycle";

/** How long (seconds) a `room-cycle` job may stay active before being retried. */
const ROOM_CYCLE_EXPIRE_SECONDS = 300;

/** Payload of a `room-cycle` job. */
export interface RoomCyclePayload {
  instanceId: string;
  instanceSlug: string;
}

/**
 * Seam 1 — the pure tick function.
 *
 * Queries enabled rooms and pending-event counts, then enqueues one
 * `room-cycle` job per room with at least one pending event. Rooms with zero
 * pending events, or whose instance slug cannot be resolved, are skipped.
 *
 * The `boss` instance is injected so the tick can be unit-tested in isolation.
 */
export async function schedulerTick(boss: PgBoss): Promise<void> {
  const [rooms, pendingCounts] = await Promise.all([
    listEnabledRooms(),
    countPendingByInstance(),
  ]);

  for (const room of rooms) {
    if ((pendingCounts.get(room.instanceId) ?? 0) === 0) continue;

    const instanceSlug = await resolveInstanceSlug(room.instanceId);
    if (!instanceSlug) {
      roomLog.warn("Scheduler", `no slug for instance ${room.instanceId}, skipping`);
      continue;
    }

    const payload: RoomCyclePayload = { instanceId: room.instanceId, instanceSlug };
    await boss.send(ROOM_CYCLE_QUEUE, payload, {
      singletonKey: room.instanceId,
      priority: 0,
      expireInSeconds: ROOM_CYCLE_EXPIRE_SECONDS,
    });
  }
}

/**
 * Boot the scheduler: start the shared pg-boss client, ensure the `room-cycle`
 * queue exists, then run `schedulerTick` immediately and on every interval.
 * Returns a stop function that clears the timer and stops pg-boss.
 */
export async function startScheduler(): Promise<() => Promise<void>> {
  await startBoss();
  await boss.createQueue(ROOM_CYCLE_QUEUE);

  const tick = (): void => {
    schedulerTick(boss).catch((err) => roomLog.error("Scheduler", "tick failed", err));
  };

  tick();
  const timer = setInterval(tick, config.room.tickIntervalMs);

  roomLog.info(
    "Scheduler",
    `pg-boss scheduler running (tick every ${config.room.tickIntervalMs / 1000}s)`,
  );

  return async () => {
    clearInterval(timer);
    await stopBoss();
    roomLog.info("Scheduler", "pg-boss scheduler stopped");
  };
}

/**
 * Run as an entrypoint only when invoked directly (`tsx`/`node scheduler.js`),
 * not when imported by tests. Wires SIGINT/SIGTERM to a graceful shutdown.
 */
async function main(): Promise<void> {
  const stop = await startScheduler();

  const shutdown = (signal: string): void => {
    roomLog.info("Scheduler", `received ${signal}, shutting down`);
    stop()
      .then(() => process.exit(0))
      .catch((err) => {
        roomLog.error("Scheduler", "shutdown failed", err);
        process.exit(1);
      });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === `file://${process.argv[1]}`;

if (isEntrypoint) {
  main().catch((err) => {
    roomLog.error("Scheduler", "fatal startup error", err);
    process.exit(1);
  });
}
