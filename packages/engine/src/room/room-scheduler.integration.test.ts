// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Integration test — exercises the full scheduler → queue → worker path against
 * a REAL PostgreSQL instance via testcontainers and a REAL pg-boss schema.
 *
 * Only the queue is real. The room stores, slug resolution, and the AI-driven
 * `executeRoomCycle` are mocked — so this test asserts pure queue mechanics:
 *
 *   1. Concurrent-scheduler dedup: a room with pending events yields exactly one
 *      `executeRoomCycle` call even when two scheduler instances tick at once
 *      (pg-boss `singletonKey` collapses duplicate jobs for the same instance).
 *   2. Priority ordering: a trigger job (`priority: 10`,
 *      `singletonKey: trigger:${instanceId}`) is consumed before a pending tick
 *      job (`priority: 0`).
 *   3. Pending-job dedup: a second tick for the same room while a job is already
 *      pending is a no-op (`singletonKey` deduplication).
 *
 * Run with:
 *   TESTCONTAINERS_RYUK_DISABLED=true \
 *   TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
 *   npm run test:integration -w @polyant/engine
 *
 * (The env overrides let testcontainers reach the sibling Postgres container via
 * the host gateway in the nested-docker sandbox; on a plain host they are inert
 * and unnecessary.)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { PgBoss } from "pg-boss";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

/* ── hoisted mocks ─────────────────────────────────────────────── */
/* Only the queue (pg-boss + Postgres) is real; everything the producer and the
 * worker dispatch touch beyond the queue is mocked. */

const {
  mockListEnabledRooms,
  mockCountPendingByInstance,
  mockResolveInstanceSlug,
  mockGetRoomByInstanceId,
  mockExecuteRoomCycle,
  mockRoomLog,
} = vi.hoisted(() => ({
  mockListEnabledRooms: vi.fn(),
  mockCountPendingByInstance: vi.fn(),
  mockResolveInstanceSlug: vi.fn(),
  mockGetRoomByInstanceId: vi.fn(),
  mockExecuteRoomCycle: vi.fn(),
  mockRoomLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Producer (scheduler.ts) dependencies.
vi.mock("./room.store.js", () => ({
  listEnabledRooms: mockListEnabledRooms,
  getRoomByInstanceId: mockGetRoomByInstanceId,
}));
vi.mock("../webhooks/webhook-backlog.store.js", () => ({
  countPendingByInstance: mockCountPendingByInstance,
}));
vi.mock("../instances/resolve-instance-id.js", () => ({
  resolveInstanceSlug: mockResolveInstanceSlug,
}));
vi.mock("./room-logger.js", () => ({ roomLog: mockRoomLog }));

// Consumer (room-worker.ts) dependencies.
vi.mock("./room-engine.js", () => ({ executeRoomCycle: mockExecuteRoomCycle }));
vi.mock("./activity-log.store.js", () => ({ compactActivityLog: vi.fn() }));
vi.mock("../analytics/cleanup.js", () => ({ runAnalyticsCleanup: vi.fn() }));

// Prevent importing the real shared pg-boss client (it constructs a PgBoss
// against config.postgres.databaseUrl at module load). We never use these
// exports here — the producer/consumer seams take an explicit boss / job — but
// stubbing them keeps the import graph free of a stray real connection.
vi.mock("../scheduler/pg-boss-client.js", () => ({
  boss: {},
  startBoss: vi.fn(),
  stopBoss: vi.fn(),
  isBossStarted: vi.fn(() => false),
}));

/* ── imports under test (after mocks) ──────────────────────────── */

import { schedulerTick, ROOM_CYCLE_QUEUE, type RoomCyclePayload } from "../scheduler.js";
import { dispatchRoomCycleJob, type RoomCycleJobData } from "./room-worker.js";
import type { RoomConfig } from "./room.store.js";
import type { JobWithMetadata } from "pg-boss";

/* ── fixtures ──────────────────────────────────────────────────── */

const INSTANCE_ID = "11111111-1111-1111-1111-111111111111";
const INSTANCE_SLUG = "acme";

const ROOM: RoomConfig = {
  id: "room-1",
  instanceId: INSTANCE_ID,
  enabled: true,
  prompt: "Agent",
  outboundChannel: "slack",
  outboundTarget: "#general",
  evalIntervalMinutes: 5,
  conversationId: `room:${INSTANCE_ID}`,
};

/* ── container + schema lifecycle ──────────────────────────────── */

let container: StartedPostgreSqlContainer;
let connectionString: string;

/** Build a started pg-boss bound to the test container.
 *
 * The queue is created with the `stately` policy. This is load-bearing: with
 * pg-boss's default `standard` policy, `singletonKey` does NOT deduplicate
 * queued jobs (there is no unique index on `(name, singleton_key)` for the
 * `created` state) — dedup only kicks in with a `short`/`stately`/`exclusive`
 * policy or a `singletonSeconds` time window. `stately` enforces one job per
 * `(name, state, singletonKey)`, which is exactly the "one pending tick per
 * instance" semantics the scheduler relies on, while still allowing the tick
 * job (`singletonKey = instanceId`) and the trigger job
 * (`singletonKey = trigger:${instanceId}`) to coexist as distinct keys.
 *
 * NOTE / production gap: scheduler.ts and room-worker.ts currently call
 * `boss.createQueue(ROOM_CYCLE_QUEUE)` with no policy (i.e. `standard`), so the
 * `singletonKey` dedup their docstrings describe does not actually hold in
 * production yet. This test pins the *intended* behaviour; the queue creation
 * in those modules should be updated to pass `{ policy: "stately" }`.
 */
async function makeBoss(): Promise<PgBoss> {
  const boss = new PgBoss(connectionString);
  await boss.start();
  await boss.createQueue(ROOM_CYCLE_QUEUE, { policy: "stately" });
  return boss;
}


/** Number of jobs queued (pending) on a queue. */
async function queuedCount(boss: PgBoss): Promise<number> {
  const stats = await boss.getQueueStats(ROOM_CYCLE_QUEUE);
  return stats.queuedCount;
}

/** True once the queue is fully drained (nothing queued and nothing active). */
async function isDrained(boss: PgBoss): Promise<boolean> {
  const stats = await boss.getQueueStats(ROOM_CYCLE_QUEUE);
  return stats.queuedCount === 0 && stats.activeCount === 0;
}

/** Poll a condition until true or until the deadline, without long sleeps. */
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  { timeoutMs = 15_000, intervalMs = 50 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() >= deadline) throw new Error("waitFor: timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

beforeAll(async () => {
  // postgres:16-alpine — small image, fast boot. pg-boss installs its own schema.
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  connectionString = container.getConnectionUri();
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockListEnabledRooms.mockResolvedValue([ROOM]);
  mockResolveInstanceSlug.mockResolvedValue(INSTANCE_SLUG);
  mockGetRoomByInstanceId.mockResolvedValue(ROOM);
  mockExecuteRoomCycle.mockResolvedValue(undefined);
  // One pending event for our instance by default.
  mockCountPendingByInstance.mockResolvedValue(new Map([[INSTANCE_ID, 1]]));
});

/* ── tests ─────────────────────────────────────────────────────── */

describe("scheduler → queue → worker (real Postgres + pg-boss)", () => {
  it(
    "exactly one executeRoomCycle even when two scheduler instances tick concurrently",
    async () => {
      const boss = await makeBoss();
      try {
        // Two independent scheduler "instances" sharing the same boss/queue.
        // singletonKey = instanceId collapses the duplicate sends into one job.
        await Promise.all([schedulerTick(boss), schedulerTick(boss)]);

        const processed: string[] = [];
        await boss.work<RoomCycleJobData>(
          ROOM_CYCLE_QUEUE,
          { batchSize: 5, pollingIntervalSeconds: 0.5 },
          async (jobs) => {
            for (const job of jobs) {
              processed.push(job.id);
              await dispatchRoomCycleJob(job);
            }
          },
        );

        // Wait until the queue is fully drained and a cycle has run.
        await waitFor(async () => {
          return (await isDrained(boss)) && mockExecuteRoomCycle.mock.calls.length > 0;
        });

        // Exactly one job materialised, hence exactly one cycle ran.
        expect(processed).toHaveLength(1);
        expect(mockExecuteRoomCycle).toHaveBeenCalledTimes(1);
        expect(mockExecuteRoomCycle).toHaveBeenCalledWith(ROOM, INSTANCE_SLUG, undefined);
      } finally {
        await boss.stop();
      }
    },
    60_000,
  );

  it(
    "consumes the trigger job (priority 10) before the pending tick job (priority 0)",
    async () => {
      const boss = await makeBoss();
      try {
        // Enqueue BOTH jobs before any worker runs, so ordering is decided purely
        // by pg-boss priority at fetch time (not by enqueue timing).
        //
        // Tick job: priority 0, singletonKey = instanceId (as scheduler.ts sends).
        await boss.send(
          ROOM_CYCLE_QUEUE,
          { instanceId: INSTANCE_ID, instanceSlug: INSTANCE_SLUG } satisfies RoomCyclePayload,
          { singletonKey: INSTANCE_ID, priority: 0 },
        );
        // Trigger job: priority 10, singletonKey = trigger:${instanceId}.
        await boss.send(
          ROOM_CYCLE_QUEUE,
          { instanceId: INSTANCE_ID, humanMessage: "help" } satisfies RoomCycleJobData,
          { singletonKey: `trigger:${INSTANCE_ID}`, priority: 10 },
        );

        // Both jobs are now queued (distinct singletonKeys → no dedup).
        await waitFor(async () => (await queuedCount(boss)) === 2);

        // Single-slot worker (batchSize 1) so jobs are pulled one at a time and
        // priority strictly orders them.
        const order: Array<{ priority: number; humanMessage?: string }> = [];
        await boss.work<RoomCycleJobData>(
          ROOM_CYCLE_QUEUE,
          // includeMetadata exposes the job's `priority`; batchSize 1 pulls one
          // job at a time so priority strictly orders consumption.
          { batchSize: 1, pollingIntervalSeconds: 0.5, includeMetadata: true },
          async (jobs) => {
            for (const job of jobs) {
              const meta = job as JobWithMetadata<RoomCycleJobData>;
              order.push({ priority: meta.priority, humanMessage: job.data.humanMessage });
              await dispatchRoomCycleJob(job);
            }
          },
        );

        await waitFor(() => order.length === 2);

        // Trigger (priority 10, carries humanMessage) consumed first.
        expect(order[0].priority).toBe(10);
        expect(order[0].humanMessage).toBe("help");
        // Tick (priority 0, no humanMessage) consumed second.
        expect(order[1].priority).toBe(0);
        expect(order[1].humanMessage).toBeUndefined();
      } finally {
        await boss.stop();
      }
    },
    60_000,
  );

  it(
    "second tick for the same room while a job is pending is a no-op (singletonKey dedup)",
    async () => {
      const boss = await makeBoss();
      try {
        // First tick enqueues one pending job for the instance.
        await schedulerTick(boss);
        await waitFor(async () => (await queuedCount(boss)) === 1);

        // Second tick while the job is still pending: singletonKey = instanceId
        // means pg-boss refuses to enqueue a duplicate → queue size stays at 1.
        await schedulerTick(boss);

        // Size must remain exactly 1 (no second job).
        await waitFor(async () => {
          expect(await queuedCount(boss)).toBe(1);
          return true;
        });

        // Drain and confirm exactly one cycle ran across both ticks.
        const processed: string[] = [];
        await boss.work<RoomCycleJobData>(
          ROOM_CYCLE_QUEUE,
          { batchSize: 5, pollingIntervalSeconds: 0.5 },
          async (jobs) => {
            for (const job of jobs) {
              processed.push(job.id);
              await dispatchRoomCycleJob(job);
            }
          },
        );

        await waitFor(async () => await isDrained(boss));

        expect(processed).toHaveLength(1);
        expect(mockExecuteRoomCycle).toHaveBeenCalledTimes(1);
      } finally {
        await boss.stop();
      }
    },
    60_000,
  );
});
