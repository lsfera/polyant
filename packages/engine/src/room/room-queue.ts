// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Single source of truth for the `room-cycle` queue: its name and its creation.
 *
 * Both the producer (scheduler.ts) and the consumer (room-worker.ts) must create
 * the queue identically; if they drift, the dedup guarantee silently breaks. To
 * make drift impossible, the queue name and the `createQueue` call live here and
 * nowhere else.
 *
 * The queue MUST use pg-boss's `stately` policy. Under the default `standard`
 * policy, `singletonKey` does NOT deduplicate queued jobs (there is no unique
 * index on `(name, singleton_key)` for the `created` state), so two concurrent
 * ticks — or a second tick while one is pending — would each create a job,
 * violating the "each room processed at most once per tick" guarantee the
 * room-cycle feature relies on for active-passive HA. `stately` enforces one job
 * per `(name, state, singletonKey)`, delivering exactly those semantics while
 * still letting the tick job (`singletonKey = instanceId`) and the trigger job
 * (`singletonKey = trigger:${instanceId}`) coexist as distinct keys.
 */

import type { PgBoss } from "pg-boss";

/** Name of the queue that carries one job per due room cycle. */
export const ROOM_CYCLE_QUEUE = "room-cycle";

/**
 * Ensure the `room-cycle` queue exists with the `stately` policy.
 *
 * Idempotent (pg-boss `createQueue` is a no-op if the queue already exists with
 * the same config). This is the ONLY place the `room-cycle` queue is created —
 * every producer and consumer must call this so the policy can never drift.
 */
export async function ensureRoomCycleQueue(boss: PgBoss): Promise<void> {
  await boss.createQueue(ROOM_CYCLE_QUEUE, { policy: "stately" });
}
