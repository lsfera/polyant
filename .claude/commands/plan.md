---
description: "Use this to create a structured implementation plan for a feature, refactoring, or migration. Delegates to the planner agent."
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep, WebSearch
---

# /plan — Structured Implementation Plan

## Agent
Delegate to: `.claude/agents/planner.md`

## Workflow

### Phase 1: Understand
1. Read project context (`AGENTS.md`, `CLAUDE.md`, codebase structure)
2. Ask clarifying questions — one at a time, prefer multiple-choice
3. Summarize understanding and confirm with the user

### Phase 2: Explore Approaches
1. For each non-trivial decision, present 2-3 approaches with trade-offs:
   - **How**: technical approach
   - **Pros/Cons**: explicit trade-offs
   - **Effort**: Low/Medium/High
2. User selects preferred approach (or suggests alternative)

### Phase 3: Design Plan
1. Break down into ordered phases with clear deliverables
2. Map dependencies: what blocks what
3. Identify risks per phase
4. Write scenarios in GIVEN-WHEN-THEN format
5. Document constraints and YAGNI decisions

### Phase 4: Output
Save plan as: `docs/plans/YYYYMMDD-<topic>-plan.md`

```markdown
# Plan: [Topic]

## Context
[What and why]

## Decision
[Selected approach and rationale]

## Phases
1. [Phase] — [deliverable] — [effort]
2. ...

## Scenarios
- GIVEN ... WHEN ... THEN ...

## Constraints
- [What we decided NOT to do]

## Risks
- [Risk] → [Mitigation]
```

### Phase 5: Confirmation
**MANDATORY**: Present complete plan. Do NOT proceed to implementation without explicit user confirmation.
