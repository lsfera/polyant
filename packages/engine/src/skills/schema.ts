// SPDX-License-Identifier: AGPL-3.0-or-later

import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, unique, index } from "drizzle-orm/pg-core";
import { tools } from "../agents/tools/tools.schema.js";

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  category: varchar("category", { length: 100 }).notNull().default("general"),
  /** Managed at application level (circular ref with skill_versions). */
  currentVersionId: uuid("current_version_id"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const skillVersions = pgTable(
  "skill_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 50 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull(),
    scripts: jsonb("scripts").$type<{ file: string; description: string; content: string }[]>().notNull().default([]),
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_skill_version").on(table.skillId, table.version),
    index("idx_skill_versions_skill").on(table.skillId),
  ],
);

export const skillTools = pgTable(
  "skill_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("uq_skill_tool").on(table.skillId, table.toolId),
  ],
);
