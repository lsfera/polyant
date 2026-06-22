# PRD: Scheduler Microservice (pg-boss)

## Problem Statement

The room scheduler — responsible for processing pending webhook events and triggering room AI cycles — runs as an in-memory singleton inside the engine process. This creates two operational problems:

1. **Single point of failure.** If the engine process crashes, scheduling stops entirely until restart. There is no standby to take over.
2. **Cannot scale independently.** The scheduler is tightly bound to the engine HTTP/AI pipeline. A burst of room cycles saturates the same process that handles user messages, and there is no way to add scheduler capacity without also adding engine capacity.

## Solution

Extract the tick loop into a dedicated scheduler process (a second entrypoint inside the `engine` package) backed by **pg-boss** — a PostgreSQL-native job queue. The scheduler enqueues `room-cycle` jobs; engine workers consume and execute them by calling `executeRoomCycle`.

Multiple scheduler instances can run simultaneously. pg-boss `singletonKey` deduplication ensures each room is processed at most once per tick, giving implicit active-passive high availability with no leader-election code. Engine workers scale independently from the scheduler. Both processes share the existing PostgreSQL database — no new infrastructure is required.

## User Stories

1. As a platform operator, I want to run a standby scheduler instance alongside the active one, so that scheduling continues without interruption if the active instance crashes.
2. As a platform operator, I want both scheduler instances to process the same set of rooms without double-executing any room, so that agents do not receive duplicate event triggers.
3. As a platform operator, I want to scale engine workers independently from the scheduler, so that I can add AI execution capacity during event bursts without also duplicating the scheduling loop.
4. As a platform operator, I want to deploy the scheduler using the same Docker image as the engine, so that I do not need to maintain a separate build pipeline or container registry entry.
5. As a platform operator, I want the scheduler to restart and resume normal operation after a crash without manual intervention, so that pending room events are not silently dropped.
6. As a platform operator, I want stuck `PROCESSING` events in the backlog to be automatically reset to `PENDING` on engine restart, so that a mid-cycle crash never permanently blocks a room.
7. As a platform operator, I want pg-boss to expire orphaned in-progress jobs after a configurable timeout, so that a crashed worker does not hold a job slot indefinitely.
8. As a platform operator, I want to inspect the job queue via pg-boss's built-in monitoring tables, so that I can observe scheduler health without custom tooling.
9. As a developer building on Polyant, I want a human message arriving on a room's channel to immediately trigger a room cycle, so that the assistant responds promptly rather than waiting up to 30 seconds for the next tick.
10. As a developer building on Polyant, I want the immediate trigger path to deduplicate against any already-pending tick job, so that a human message never causes two concurrent cycle executions for the same room.
11. As a developer building on Polyant, I want human-triggered cycles to be processed at higher priority than tick-triggered cycles, so that interactive responses are not delayed by a backlog of automated event processing.
12. As a developer building on Polyant, I want daily housekeeping (activity log compaction and analytics retention cleanup) to continue running without the scheduler process being involved, so that housekeeping is not disrupted when the scheduler is restarted.
13. As a developer building on Polyant, I want the existing `executeRoomCycle` function to remain the single execution entry point for room cycles regardless of what triggered them, so that all cycle logic stays in one place.
14. As a platform operator, I want to extend the scheduler to support pool-based partitioning in the future, so that I can assign subsets of instances to dedicated scheduler shards.
15. As a developer building on Polyant, I want the existing unit tests for the scheduler and worker to run in CI without any external dependencies, so that the test suite remains fast and portable.
16. As a developer building on Polyant, I want an integration test that exercises the full scheduler → queue → worker path against a real PostgreSQL instance, so that pg-boss deduplication and priority semantics are verified in a realistic environment.

## Implementation Decisions

### Architecture

The room scheduler is refactored from a push model (in-process singleton calling `executeRoomCycle` directly) to a queue model:

- **Scheduler process** (`scheduler.ts` entrypoint): on every 30-second tick, queries `listEnabledRooms` and `countPendingByInstance`, then enqueues a `room-cycle` job for each room that has pending events. Uses pg-boss `singletonKey: instanceId` to prevent duplicate pending jobs. Multiple scheduler instances can run concurrently — deduplication is handled by pg-boss at the database level.
- **Engine worker** (inside the main engine process): subscribes to the `room-cycle` queue via pg-boss. On job receipt, resolves the instance slug and calls `executeRoomCycle(room, slug, humanMessage?)`. The engine retains its full HTTP/AI pipeline — the worker subscription is an additional responsibility, not a replacement.

### Package structure

The scheduler is a second entrypoint inside `@polyant/engine` (`packages/engine/src/scheduler.ts`). It shares all existing stores, schemas, and the database client via relative imports — no new package, no exports map changes. Deployment uses the same Docker image with a different `CMD`:

- Engine: `node dist/index.js`
- Scheduler: `node dist/scheduler.js`

### Job schema

Single queue name: `room-cycle`

| Field | Tick job | Trigger job |
|---|---|---|
| `payload.instanceId` | instance UUID | instance UUID |
| `payload.humanMessage` | absent | message text |
| `singletonKey` | `instanceId` | `trigger:${instanceId}` |
| `priority` | `0` | `10` |
| `expireInSeconds` | `300` | `300` |

The two `singletonKey` namespaces allow a tick job and a trigger job to coexist in the queue for the same instance. pg-boss priority ordering ensures the trigger job is claimed first when both are pending.

### Active-passive high availability

No explicit leader election. Both scheduler instances run their tick loop. When both attempt to enqueue a job for the same room, the second `send()` call is a no-op because pg-boss enforces that only one job with a given `singletonKey` exists in `created` or `active` state at a time. Redundant DB reads on each tick are the accepted cost.

This guarantee is exercised end-to-end under real horizontal scaling by the smoke-test harness in [`packages/engine/test/scale-ha/`](../packages/engine/test/scale-ha/) — two engine replicas behind a load balancer, sharing one queue (see Seam 5 below).

### `triggerImmediate` path

The existing call to `roomScheduler.triggerImmediate()` in the message pipeline (`index.ts`) is replaced with a direct pg-boss `send()` call on the `room-cycle` queue. The engine process is both a pg-boss producer (for triggers) and a consumer (worker subscription). This avoids any HTTP round-trip between engine and scheduler and keeps the trigger path entirely in-process.

### Housekeeping

Daily housekeeping (activity log compaction via `compactActivityLog`, analytics retention via `runAnalyticsCleanup`) remains in the engine process as a `setInterval` loop. It is not migrated to pg-boss. Housekeeping has no coordination requirements — running it on every engine replica is safe and idempotent.

### Concurrency safety

The `listAndMarkPendingEventsProcessing` function uses a `SELECT … FOR UPDATE` transaction. If two workers race on the same room's backlog, the second claims zero events and exits early (`if (!humanMessage && pendingEvents.length === 0) return`). No PostgreSQL advisory lock or application-level mutex is needed to replace the removed in-memory `running` Set.

### Crash recovery

Two complementary mechanisms:

1. `resetStuckProcessingEvents()` is called at engine boot (existing behavior, unchanged) — resets backlog events stuck in `PROCESSING` back to `PENDING` after a mid-cycle crash.
2. pg-boss `expireInSeconds: 300` on all jobs — expires orphaned `active` jobs if the worker process dies mid-execution, freeing the slot for retry.

### Migration

Hard cutover. The `RoomScheduler` class and `roomScheduler` singleton are removed entirely. No feature flag, no dual code path. Engine tests for the old scheduler are replaced by tests for the new scheduler tick function and the new worker dispatch function.

### Future extension: pool-based partitioning

The scheduler entrypoint is written to accept a `POOL_ID` and `TOTAL_POOLS` env var pair. When both are set, the tick loop filters rooms by `hash(instanceId) % TOTAL_POOLS === POOL_ID`. When unset (the default), the scheduler processes all rooms. This extension point requires no schema changes.

## Testing Decisions

A good test for this feature tests the *contract* between components — what jobs get enqueued given a set of rooms, and what functions get called given a job — not the internal wiring of pg-boss or the engine bootstrap sequence.

**Seam 1 — Scheduler tick (unit):**
Mock `listEnabledRooms`, `countPendingByInstance`, and pg-boss `send()`. Call the tick function directly. Assert the correct `singletonKey`, `priority`, and `payload` for each enqueued job. Assert nothing is enqueued for rooms with zero pending events. Prior art: existing `tick()` tests in `room-scheduler.test.ts`.

**Seam 2 — Engine worker dispatch (unit):**
Mock `executeRoomCycle` and the pg-boss worker callback. Inject synthetic job objects. Assert `executeRoomCycle` is called with the correct `room`, `slug`, and optional `humanMessage` for both tick jobs and trigger jobs. Prior art: `triggerImmediate` and `processRoom` tests in `room-scheduler.test.ts`.

**Seam 3 — Trigger enqueue path (unit):**
Mock the pg-boss client in the message pipeline. Assert that the `send()` call for an inbound human message uses `priority: 10` and `singletonKey: trigger:${instanceId}`. Prior art: existing message-pipeline mocking in `index.ts` tests.

**Seam 4 — Full round-trip (integration, testcontainers):**
Spin up a real PostgreSQL container (`@testcontainers/postgresql`). Initialize the pg-boss schema. Run the scheduler tick and the engine worker against the same queue. Mock `executeRoomCycle` and the room stores. Assert:

- A room with pending events results in exactly one `executeRoomCycle` call, even when two scheduler instances tick concurrently.
- A trigger job with `priority: 10` is consumed before a pending tick job.
- A second tick for the same room while a job is pending is a no-op.

File convention: `room-scheduler.integration.test.ts`. Test suite runs under `npm run test:integration`.

**Seam 5 — Horizontal-scale smoke test (manual, docker compose):**
Stand up the production engine image as **two replicas behind an nginx load
balancer**, sharing one Postgres, and verify the active-passive HA design holds
under real scaling rather than in-process simulation. Each replica runs the full
engine (HTTP API + room worker), so the two replicas are two workers competing
on the same `room-cycle` queue. Assert:

- HTTP requests through the LB fan out across both replicas (observed via the
  `X-Upstream` response header).
- A burst of distinct triggers is processed **exactly once** — no instance is
  handled by both workers, and none is handled twice.
- Duplicate `singletonKey`s collapse to a single job (the `stately` policy from
  `room-queue.ts`).

This is a manual test (it builds an image and needs a Docker daemon), kept out
of CI and complementary to Seam 4's testcontainers run. Harness, runner, and
expected output: [`packages/engine/test/scale-ha/`](../packages/engine/test/scale-ha/)
(`./verify.sh`).

## Out of Scope

- **Pool-based partitioning** — the extension point is built in, but the runtime behavior and operational tooling for managing pools are not part of this PRD.
- **Two separate named queues** (`room-tick` / `room-trigger`) — deferred as a possible future upgrade from the single-queue design.
- **Redis / BullMQ** — explicitly rejected; pg-boss on existing PostgreSQL meets all requirements.
- **HTTP API for the scheduler service** — the scheduler exposes no HTTP endpoint; it is a headless tick process.
- **Admin panel changes** — no UI changes are required for this feature.
- **Multi-tenancy / organization-scoped scheduling** — out of scope until Phase 2 multi-tenancy is designed.

## Further Notes

- pg-boss creates its own schema (`pgboss.*`) in the PostgreSQL database on first start. This happens automatically via `PgBoss.start()` — no manual migration is required, but the DB user must have schema creation privileges.
- The `expireInSeconds: 300` timeout sets a ceiling on room cycle duration. If a room cycle legitimately takes longer than 5 minutes (e.g. a very long LLM chain), this value should be increased via config.
- pg-boss monitoring tables (`pgboss.job`, `pgboss.archive`) provide built-in visibility into queue depth, job state, and failure history without custom tooling.
- The `ROOM_TICK_INTERVAL_MS` constant (currently `30_000`) should be moved to `config.ts` as a Zod-validated env var so it can be tuned per deployment without a code change.
