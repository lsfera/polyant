---
description: "Use this to run a verification loop: define criteria → implement → verify → report. Combines code graders (tests, build) with model graders (quality analysis)."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /verify — Verification Loop

## Purpose
Systematic verification that implementation meets defined success criteria. Combines automated checks (code graders) with qualitative analysis (model graders).

## Workflow

### Step 1: Define Success Criteria
Before verification, establish what "done" means:

```markdown
## Verification Criteria
- [ ] Tests pass (code grader)
- [ ] Build succeeds (code grader)
- [ ] Lint passes (code grader)
- [ ] Coverage ≥80% for new code (code grader)
- [ ] No security issues (model grader)
- [ ] Error handling complete (model grader)
- [ ] API contract matches spec (model grader)
```

### Step 2: Code Graders (Automated)
Run automated checks:

```bash
# Tests
npm test / pytest / go test ./...

# Build
npm run build / python -m py_compile / go build ./...

# Lint
npm run lint / ruff check . / golangci-lint run

# Coverage
npm run test:coverage / pytest --cov
```

Report pass/fail for each.

### Step 3: Model Graders (Qualitative)
Analyze code for qualitative criteria:
- Security: scan for OWASP vulnerabilities in changed code
- Error handling: verify all error paths are covered
- API contract: compare implementation with spec/plan
- Edge cases: identify unhandled boundary conditions

### Step 4: Report

```markdown
# Verification Report

## Code Graders
| Check | Status | Details |
|-------|--------|---------|
| Tests | ✅ PASS | 42/42 passing |
| Build | ✅ PASS | No errors |
| Lint | ⚠️ WARN | 2 warnings (non-blocking) |
| Coverage | ✅ PASS | 87% (target: 80%) |

## Model Graders
| Check | Status | Details |
|-------|--------|---------|
| Security | ✅ PASS | No OWASP issues found |
| Error handling | ⚠️ WARN | Missing handler for timeout in service X |
| API contract | ✅ PASS | Matches spec |

## Verdict: PASS / FAIL
[Summary and any required actions]
```

### Step 5: Iterate (if FAIL)
- Fix the failing criteria
- Re-run ONLY the failed checks
- Repeat until all criteria pass
