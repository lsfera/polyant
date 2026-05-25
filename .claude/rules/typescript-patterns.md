---
description: "Enforce TypeScript backend patterns: Drizzle ORM, module organization, database conventions"
globs: ["**/*.ts"]
alwaysApply: true
---

# TypeScript Backend Patterns Rules

## MUST (violations block PR)

### Drizzle ORM
- Schema co-located with the domain: `modules/{feature}/schema.ts`, never inside a centralized `schema/` folder
- Primary key: `uuid('id').primaryKey().defaultRandom()` — always UUID, always auto-generated
- Timestamps: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()` — `withTimezone: true` is mandatory
- JSONB: MUST use `.$type<T>()` with `.default({})` for type safety
- Indexes: defined as the third argument of `pgTable`, never as separate statements
- Column naming: database in `snake_case`, TypeScript in `camelCase`

### Module Organization
- Feature-based: `modules/{feature}/` containing controller, service, schema, test
- Never layer-based: no `controllers/`, `services/`, `schemas/` at the root
- Barrel exports: every module has an `index.ts` exposing the public interface

## SHOULD (warnings)

- Migration files generated automatically by Drizzle Kit, never written by hand
- Relations defined in `relations()` separate from the schema to avoid circular dependencies
- Transaction wrapper for multi-table operations
