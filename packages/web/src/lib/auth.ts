// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Full Auth.js config with Drizzle DB adapter.
 * Only used in server-side Node.js contexts (API routes, server components).
 * Middleware uses auth.config.ts instead (Edge-compatible).
 */
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { authConfig } from "./auth.config";

const connectionString = process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER ?? "polyant"}:${process.env.POSTGRES_PASSWORD ?? ""}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "polyant"}`;

const queryClient = postgres(connectionString);
const db = drizzle(queryClient);

/**
 * Auth.js-compatible schema matching engine's users.schema.ts
 * (snake_case DB columns, custom table names)
 */
const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
});

const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

const verificationTokensTable = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- DrizzleAdapter types conflict between drizzle-orm versions (engine 0.38 vs web 0.45)
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db as any, {
    usersTable: usersTable as any,
    accountsTable: accountsTable as any,
    sessionsTable: sessionsTable as any,
    verificationTokensTable: verificationTokensTable as any,
  }),
});
