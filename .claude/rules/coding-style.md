---
description: "Enforce consistent coding style, SOLID principles, and error handling across all projects"
globs: ["**/*.ts", "**/*.tsx", "**/*.py", "**/*.js", "**/*.jsx"]
alwaysApply: true
---

# Coding Style Rules

## MUST (violations block PR)

- **Single Responsibility**: every file/class/function has ONE responsibility. If the name contains "And", split it.
- **No business logic in controllers/routes**: controllers/routes are HTTP bridges — they delegate to the service layer immediately.
- **No magic strings**: use enums/constants for repeated values. Never hardcode strings for states, types, or configuration.
- **Error handling is mandatory**: every external call (API, DB, file I/O) MUST have explicit error handling.
- **No hardcoded secrets**: credentials, API keys, and connection strings MUST come from environment variables. Never in code.
- **No session/connection leaks**: every opened resource (DB session, file handle, HTTP client) MUST be closed in `finally`/`with`/`using`.
- **DRY**: duplicated code >3 identical lines → extract into a function. Exception: tests (readability wins).
- **Consistent naming**: variables/functions in camelCase (TS/JS) or snake_case (Python). Classes in PascalCase. Constants in UPPER_SNAKE_CASE.

### Immutability First
- Prefer `const`/`readonly`/`final` wherever possible. Mutate only when strictly necessary.
- Array/Object: use spread/destructuring to create new instances instead of mutating (`[...arr, item]`, not `arr.push(item)`).
- Python: prefer tuples over lists for immutable collections, `@dataclass(frozen=True)` for DTOs.

### File Size
- Files ≤400 lines. If exceeded → split by responsibility (one file = one concept).
- Functions ≤30 lines. If exceeded → extract sub-functions with descriptive names.
- If a class exceeds 200 lines → it likely has too many responsibilities.

## SHOULD (warnings)

- Prefer composition over inheritance (Dependency Inversion)
- No `console.log` in production code (use a structured logger)
- Prefer early return over deep nesting (`if (!valid) return` > `if (valid) { ... }`)
- Avoid N+1 queries: load relations in batch, not in a loop

### Pre-Completion Checklist
Before considering the code "done", verify:
- [ ] All critical paths have error handling
- [ ] No hardcoded secrets
- [ ] Inputs validated with a schema (Zod/Pydantic)
- [ ] Opened resources are closed (DB connections, file handles)
- [ ] Naming consistent with surrounding context
- [ ] No TODOs left without an associated ticket/issue
