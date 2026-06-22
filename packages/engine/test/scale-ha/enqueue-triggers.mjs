// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Enqueue synthetic `room-cycle` triggers to exercise the stately queue while
// two engine workers compete. Sends 40 distinct triggers plus 5 duplicates of
// a single `singletonKey` — the stately policy must collapse the duplicates to
// one job. Run inside an engine container (DATABASE_URL is already in its env):
//
//   docker compose exec -T engine node --input-type=module - < enqueue-triggers.mjs

import { PgBoss } from "pg-boss";

const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();
// Idempotent; must match the engine's own queue config (see room-queue.ts).
await boss.createQueue("room-cycle", { policy: "stately" });

for (let i = 1; i <= 40; i++) {
  const id = `inst-${String(i).padStart(3, "0")}`;
  await boss.send("room-cycle", { instanceId: id }, { singletonKey: `trigger:${id}`, priority: 10 });
}
console.log("enqueued 40 distinct triggers");

for (let k = 0; k < 5; k++) {
  await boss.send("room-cycle", { instanceId: "inst-DUP" }, { singletonKey: "trigger:inst-DUP", priority: 10 });
}
console.log("sent 5 duplicate triggers for inst-DUP (same singletonKey)");

await boss.stop();
