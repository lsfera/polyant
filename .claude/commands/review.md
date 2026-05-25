---
description: "Use this for a structured code review. Runs code-reviewer + security-reviewer agents and produces a consolidated report."
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
---

# /review — Orchestrated Code Review

## Agents
1. `.claude/agents/code-reviewer.md` — quality, SOLID, performance
2. `.claude/agents/security-reviewer.md` — OWASP, secrets, dependencies

## Workflow

### Step 1: Identify Scope
1. Detect what to review:
   - If on a branch: `git diff main...HEAD`
   - If staged changes: `git diff --cached`
   - If specific files: user-provided paths
2. Read project context: `AGENTS.md`, `CLAUDE.md`

### Step 2: Code Quality Review
Run `.claude/agents/code-reviewer.md` workflow:
- SOLID principles check
- Error handling completeness
- Performance red flags (N+1, missing indexes, blocking calls)
- Style and naming consistency
- Test coverage adequacy

### Step 3: Security Review
Run `.claude/agents/security-reviewer.md` workflow:
- OWASP Top 10 scan on changed files
- Secret scanning (hardcoded credentials, API keys)
- Input validation completeness
- Auth/authz coverage on new endpoints

### Step 4: Consolidated Report

```markdown
# Code Review Report

## Summary
- Files reviewed: N
- Total findings: N (X critical, Y high, Z medium)
- Verdict: APPROVE | REQUEST CHANGES

## Critical Issues
[CRITICAL] file:line — Description
  Rule: rules/common/security.md
  Fix: ...

## High Issues
[HIGH] file:line — Description
  ...

## Medium/Low Issues
...

## Positive Notes
- [What was done well]
```

### Step 5: Verdict
- **APPROVE**: 0 critical + 0 high issues
- **REQUEST CHANGES**: any critical or high issue
- **COMMENT**: only medium/low, nothing blocking
