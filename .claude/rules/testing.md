---
description: "Enforce testing standards: coverage, classification, and structure"
globs: ["**/*.test.*", "**/*.spec.*", "**/test_*.py", "**/*_test.py", "**/*_test.go"]
alwaysApply: true
---

# Testing Rules

## MUST (violations block PR)

### Coverage
- Minimum coverage target: 80% for new code
- Every PR adding business logic MUST include tests
- Critical paths (auth, payments, data mutation) MUST have 100% coverage

### Failure Classification
- Every test failure MUST be classified as: **REGRESSION**, **TEST OUTDATED**, **FLAKY**, or **ASSERTION MISMATCH**
- Never assume all failures are regressions — verify with `git log` on the involved files
- Before updating an assertion: VERIFY the behavior change was intentional

**Detailed taxonomy**:

| Type | Signal | Action |
|------|--------|--------|
| **REGRESSION** | Test passed before the change, fails now | Fix the code, not the test |
| **TEST OUTDATED** | Behavior changed intentionally | Update test to match new spec |
| **FLAKY** | Passes/fails without code changes | Quarantine, track, fix timing/deps |
| **ASSERTION MISMATCH** | Expected value wrong, logic correct | Verify spec, then update assertion |
| **ENVIRONMENT** | Works locally, fails in CI | Check deps, env vars, OS differences |

### Confidence Rule
- Reporting a test failure as "fixed" requires ≥80% confidence the fix is correct
- If confidence <80%: state the uncertainty and propose verification steps

### Structure
- Tests MUST include a `file:line` reference for every failure
- Group failures by module/package to spot patterns
- Every test MUST test ONE thing (single assertion per concept, not per line)

### Flaky Tests
- Flaky tests MUST be flagged and tracked — they mask real regressions
- Patterns to watch for: timing dependencies, execution order, external resources

## SHOULD (warnings)

- Arrange-Act-Assert (AAA) pattern for every test
- Test name: `should_[expected]_when_[condition]` or the framework equivalent
- Mock only external dependencies (API, DB) — never mock the code under test
- Integration test for every critical API endpoint
- Cover edge cases: null/undefined, empty collections, boundary values
