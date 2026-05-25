---
description: "Enforce TypeScript conventions: ESM, named exports, file naming, Zod config"
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# TypeScript Style Rules

## MUST (violations block PR)

### ESM & Imports
- ALL relative imports MUST end in `.js` — ESM requires it at runtime. No exceptions.
- Never use default exports. ALWAYS named exports for refactoring and tree-shaking.
- Import order: 1) node built-ins, 2) external packages, 3) internal modules, 4) relative

### File Naming
- ALL files in **kebab-case**: `user.schema.ts`, `user-profile.store.ts`
- Never camelCase or PascalCase for filenames
- Convention: `{entity}.{type}.ts` where type = `schema`, `service`, `controller`, `store`, `util`, `test`

### Configuration
- `process.env` MUST never be read directly in application code
- ALL env vars MUST be validated with Zod at startup: `safeParse()` + `process.exit(1)` on failure
- Centralized configuration in a single `config.ts` per module/service

### NestJS (where applicable)
- Controller = pure HTTP bridge. Zero business logic. Immediate delegation to a service.
- Service = business logic. Never accesses HTTP request/response directly.
- Module organization: feature-based, not layer-based

## SHOULD (warnings)

- Prefer exported functions over classes for stateless operations
- `strict: true` in `tsconfig.json` — includes `strictNullChecks`, `noImplicitAny`
- Avoid `any` — use `unknown` + type guards when the type is unknown
- Prefer `interface` for objects, `type` for union/utility types
