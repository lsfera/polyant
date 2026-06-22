<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Horizontal-scale smoke test (room-cycle scheduler)

A docker-compose harness that runs **two engine replicas behind an nginx load
balancer** on a shared Postgres, to verify the active-passive HA design from
[`docs/prd-scheduler-microservice.md`](../../../../docs/prd-scheduler-microservice.md)
holds under real horizontal scaling.

Each replica runs the full engine — the NestJS HTTP API **and** the pg-boss
room worker in one process. So two replicas means two workers competing on the
same `room-cycle` queue, which is exactly the condition the queue's `stately`
policy + `singletonKey` dedup exists for (see
[`src/room/room-queue.ts`](../../src/room/room-queue.ts)).

This is a **manual** smoke test (it builds a Docker image and needs a Docker
daemon), complementary to the fast, dependency-free unit tests and the
testcontainers integration test (`src/room/room-scheduler.integration.test.ts`)
that run in CI.

## What it verifies

| # | Property | How |
|---|----------|-----|
| 1 | HTTP requests fan out across both replicas | hit `/health` through the LB; read the `X-Upstream` header nginx adds |
| 2 | Every trigger is processed **exactly once** | enqueue 40 distinct triggers; assert no instance is handled by both workers and none is handled twice |
| 3 | Duplicate `singletonKey`s collapse | send the same key 5×; assert it is handled exactly once |

## Run

```bash
cd packages/engine/test/scale-ha
./verify.sh          # builds, runs the checks, tears down
KEEP=1 ./verify.sh   # leave the stack up to poke at it
```

With `KEEP=1`, the balanced API is reachable at `http://localhost:8088/health`
(override the port with `LB_PORT`). Tear down with
`docker compose down -v`.

Expected tail:

```
PASS — load balanced across 2 replicas; every cycle processed exactly once.
```

## Files

- `docker-compose.yml` — postgres + `engine` (`replicas: 2`) + nginx `lb`
- `Dockerfile.lb` / `nginx.conf` — the load balancer (config baked in, not
  bind-mounted, so it also works under docker-outside-of-docker)
- `enqueue-triggers.mjs` — publishes the synthetic triggers via the real
  pg-boss client
- `verify.sh` — orchestrates the run and asserts the outcome

## Notes

- The triggers are **synthetic** (`inst-001` … `inst-DUP`) and the DB is not
  seeded, so each job is claimed and then skipped/failed at room resolution.
  Both outcomes are caught and swallowed by `dispatchRoomCycleJob`, so neither
  retries — which is precisely why the exactly-once count is meaningful: it
  isolates the **concurrency** guarantee without needing LLM credentials.
- Secrets in `docker-compose.yml` are throwaway test placeholders.
- Inside a devcontainer (docker-outside-of-docker), image pulls can fail with a
  credential-helper error. Work around it with an empty docker config:
  ```bash
  mkdir -p /tmp/empty && printf '{}' > /tmp/empty/config.json
  DOCKER_CONFIG=/tmp/empty ./verify.sh
  ```
