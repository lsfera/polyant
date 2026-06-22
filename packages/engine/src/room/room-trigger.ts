// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Room trigger producer.
 *
 * When a human replies on a Room's outbound channel, the message pipeline
 * enqueues a high-priority `room-cycle` job carrying the human message instead
 * of running the cycle inline. The engine worker (room-worker.ts) drains it.
 *
 * The `trigger:${instanceId}` singletonKey namespace is distinct from the tick
 * path's `instanceId` key, so a pending trigger and a pending tick for the same
 * instance can coexist without either being deduplicated away — while pg-boss
 * still collapses duplicate triggers for the same instance.
 */

import { boss } from "../scheduler/pg-boss-client.js";
import { ROOM_CYCLE_QUEUE } from "../scheduler.js";

/** Priority for trigger jobs — above tick jobs (priority 0) so humans jump the queue. */
const TRIGGER_PRIORITY = 10;

/** How long (seconds) a trigger `room-cycle` job may stay active before retry. */
const TRIGGER_EXPIRE_SECONDS = 300;

/**
 * Enqueue a high-priority `room-cycle` job for an inbound human message.
 * Replaces the former `roomScheduler.triggerImmediate()` inline execution.
 */
export async function enqueueRoomTrigger(instanceId: string, humanMessage: string): Promise<void> {
  await boss.send(
    ROOM_CYCLE_QUEUE,
    { instanceId, humanMessage },
    {
      singletonKey: `trigger:${instanceId}`,
      priority: TRIGGER_PRIORITY,
      expireInSeconds: TRIGGER_EXPIRE_SECONDS,
    },
  );
}
