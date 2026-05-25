---
description: "Use this to implement a feature with test-first methodology. Red→Green→Refactor cycle with coverage targets."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /tdd — Test-Driven Development

## Agent
Delegate to: `.claude/agents/tdd-guide.md`

## Workflow

### Step 1: Understand the Feature
1. Read the requirement or plan (`docs/plans/` if available)
2. Identify the components to implement: service, route, model, UI
3. List the behaviors to test (happy path, edge cases, errors)

### Step 2: RED — Write Failing Tests
1. Create test file(s) for each component
2. Write test cases covering:
   - Happy path (expected input → expected output)
   - Edge cases (null, empty, boundary values, large inputs)
   - Error cases (invalid input, service down, permission denied)
3. Run tests: `npm test` / `pytest` / framework equivalent
4. **Verify they FAIL** — if they pass, the test is wrong

### Step 3: GREEN — Implement
1. Write the MINIMUM code to make ALL tests pass
2. No optimization, no abstractions — just make it work
3. Run tests: **all must pass**
4. If a test fails, fix the implementation (NOT the test)

### Step 4: REFACTOR — Clean Up
1. Refactor implementation while keeping tests green
2. Extract patterns, improve naming, simplify logic
3. Run tests after EVERY change — stay green

### Step 5: VERIFY — Coverage
1. Run coverage report
2. Target: ≥80% for new code
3. Critical paths (auth, payments): 100%
4. Add targeted tests for uncovered branches

### Output
Report:
```
Tests: X passing, Y failing
Coverage: XX% (new code: XX%)
Uncovered: [list of uncovered branches if <80%]
```
