#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Horizontal-scale smoke test: bring up 2 engine replicas behind an nginx load
# balancer on a shared Postgres, then verify two properties end-to-end:
#
#   1. HTTP load balancing  — requests through the LB fan out across both
#      replicas (observed via the X-Upstream response header nginx adds).
#   2. Exactly-once cycles  — with two workers competing on the shared `stately`
#      `room-cycle` queue, every trigger is claimed by exactly one worker and
#      duplicate singletonKeys collapse to a single job (the active-passive HA
#      guarantee from docs/prd-scheduler-microservice.md).
#
# Usage:   ./verify.sh            # run and tear down
#          KEEP=1 ./verify.sh     # leave the stack up afterwards
#
# Note: inside a devcontainer using docker-outside-of-docker, image pulls may
# fail with a credential-helper error. If so, run once with an empty config:
#   mkdir -p /tmp/empty && printf '{}' > /tmp/empty/config.json
#   DOCKER_CONFIG=/tmp/empty ./verify.sh

set -euo pipefail
cd "$(dirname "$0")"
CMP="docker compose"

teardown() { [ "${KEEP:-0}" = "1" ] || $CMP down -v >/dev/null 2>&1 || true; }
trap teardown EXIT

wait_for_log() { # <container-id> <needle> <max-tries>
  for _ in $(seq 1 "${3:-60}"); do
    docker logs "$1" 2>&1 | grep -q "$2" && return 0
    sleep 2
  done
  echo "timed out waiting for: $2" >&2; return 1
}

echo "==> building images"
$CMP build engine lb

echo "==> starting postgres"
$CMP up -d postgres
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$($CMP ps -q postgres)" 2>/dev/null)" = "healthy" ] && break
  sleep 2
done

echo "==> engine #1 (runs DB migrations once)"
$CMP up -d --scale engine=1 engine
wait_for_log "$($CMP ps -q engine | sed -n 1p)" "engine room worker subscribed" 60

echo "==> scaling to 2 replicas + load balancer"
$CMP up -d --scale engine=2 engine lb
wait_for_log "$($CMP ps -q engine | sed -n 2p)" "engine room worker subscribed" 60

echo
echo "===================== 1) HTTP load balancing ====================="
declare -A hits=()
for i in $(seq 1 12); do
  up="$($CMP exec -T engine wget -S -q -O /dev/null http://lb/health 2>&1 | awk '/X-Upstream/{print $2}')"
  printf "  req %2d  -> %s\n" "$i" "$up"
  hits["$up"]=$(( ${hits["$up"]:-0} + 1 ))
done
echo "  distinct replicas served: ${#hits[@]} (expect 2)"

echo
echo "================== 2) exactly-once room cycles ==================="
e1="$($CMP ps -q engine | sed -n 1p)"
e2="$($CMP ps -q engine | sed -n 2p)"
$CMP exec -T engine node --input-type=module - < enqueue-triggers.mjs
# Drain at pg-boss's own pace (it polls every ~2s); wait until no room-cycle
# job is left in a non-terminal state rather than guessing a fixed sleep.
pgc="$($CMP ps -q postgres)"
echo "  draining queue..."
for _ in $(seq 1 90); do
  remaining=$(docker exec "$pgc" psql -U polyant -d polyant -At \
    -c "select count(*) from pgboss.job where name='room-cycle' and state in ('created','active','retry');" 2>/dev/null || echo "?")
  [ "$remaining" = "0" ] && break
  sleep 2
done
completed=$(docker exec "$pgc" psql -U polyant -d polyant -At \
  -c "select count(*) from pgboss.job where name='room-cycle' and state='completed';" 2>/dev/null || echo "?")

# Each handled job logs "... for instance inst-XXX" (either "no room for
# instance" or, on an unseeded DB, "room cycle failed for instance" — both are
# caught + swallowed, so neither retries).
pat='for instance (inst-[A-Za-z0-9]+)'
docker logs "$e1" 2>&1 | grep -oE "$pat" | awk '{print $3}' | sort > /tmp/scaleha_w1
docker logs "$e2" 2>&1 | grep -oE "$pat" | awk '{print $3}' | sort > /tmp/scaleha_w2
overlap=$(comm -12 /tmp/scaleha_w1 /tmp/scaleha_w2 | wc -l | tr -d ' ')
cat /tmp/scaleha_w1 /tmp/scaleha_w2 | sort > /tmp/scaleha_all
distinct=$(sort -u /tmp/scaleha_all | wc -l | tr -d ' ')
dup=$(grep -c 'inst-DUP' /tmp/scaleha_all || true)
reprocessed=$(sort /tmp/scaleha_all | uniq -d | wc -l | tr -d ' ')

echo "  engine-1 handled : $(wc -l < /tmp/scaleha_w1 | tr -d ' ') jobs"
echo "  engine-2 handled : $(wc -l < /tmp/scaleha_w2 | tr -d ' ') jobs"
echo "  handled by both  : $overlap (expect 0)"
echo "  distinct handled : $distinct (expect 41 = 40 + inst-DUP)"
echo "  inst-DUP handled : $dup (expect 1 — stately collapses the 5 sends)"
echo "  re-processed     : $reprocessed (expect 0)"
echo "  pgboss completed : $completed (expect 41)"

echo
if [ "$overlap" = "0" ] && [ "$dup" = "1" ] && [ "$reprocessed" = "0" ] && [ "$distinct" = "41" ] && [ "$completed" = "41" ] && [ "${#hits[@]}" = "2" ]; then
  echo "PASS — load balanced across 2 replicas; every cycle processed exactly once."
else
  echo "FAIL — see counts above."; exit 1
fi
