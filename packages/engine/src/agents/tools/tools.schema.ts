// SPDX-License-Identifier: AGPL-3.0-or-later

import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  requiredSecrets: jsonb("required_secrets").$type<string[]>().notNull().default([]),
  isMeta: boolean("is_meta").notNull().default(false),
  isGlobal: boolean("is_global").notNull().default(false),
  isHarness: boolean("is_harness").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});
