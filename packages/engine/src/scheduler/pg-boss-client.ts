// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared pg-boss client.
 *
 * Exports a single `PgBoss` instance with a managed start/stop lifecycle. The
 * instance connects using the existing `DATABASE_URL` exposed by `config.ts`
 * (`config.postgres.databaseUrl`). pg-boss owns its own connection pool against
 * the same Postgres database the engine already uses.
 *
 * Multiple scheduler processes can share this client concurrently — pg-boss
 * `singletonKey` deduplication prevents duplicate `room-cycle` jobs without any
 * leader election.
 */

import { PgBoss } from "pg-boss";
import { config } from "../config.js";

/** The single, process-wide pg-boss instance. */
export const boss = new PgBoss(config.postgres.databaseUrl);

let started = false;

/**
 * Start the shared pg-boss instance (idempotent). Safe to call more than once;
 * subsequent calls are no-ops while the instance is already running.
 */
export async function startBoss(): Promise<PgBoss> {
  if (started) return boss;
  await boss.start();
  started = true;
  return boss;
}

/**
 * Stop the shared pg-boss instance (idempotent), releasing its connection pool.
 */
export async function stopBoss(): Promise<void> {
  if (!started) return;
  await boss.stop();
  started = false;
}

/** Whether the shared pg-boss instance is currently started. */
export function isBossStarted(): boolean {
  return started;
}
