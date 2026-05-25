---
description: "Use this BEFORE any creative work — creating features, building components, adding functionality, or modifying behavior. Guides structured brainstorming into a spec-driven development plan."
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Brainstorming Ideas Into Designs

## The Process

Follow these three phases strictly. Do not skip or compress them.

### Phase 1: Understand the Idea

1. Check current project state (read AGENTS.md/CLAUDE.md, skim relevant code)
2. Ask clarifying questions **one at a time** — prefer multiple-choice format
3. Keep asking until you have a clear picture of the desired outcome, constraints, and scope
4. Summarize your understanding and get explicit confirmation before moving on

### Phase 2: Explore Approaches

1. Propose **2-3 design approaches** with clear trade-offs
2. Lead with your recommended approach and explain why
3. For each approach, cover:
   - **How it works** — architecture, data flow, key components
   - **Pros** — what it does well
   - **Cons** — limitations, complexity, risks
   - **Effort estimate** — relative scale (small / medium / large)
4. Wait for the user to choose an approach before proceeding

### Phase 3: Present the Design

1. Present the chosen design in **sections of 200-300 words each**
2. After each section, pause and ask: "Does this match your vision? Should I adjust anything?"
3. Cover at minimum:
   - **Data model** — entities, relationships, key fields
   - **API / interface** — endpoints, actions, inputs/outputs
   - **UI flow** (if applicable) — screens, states, interactions
   - **Edge cases** — what happens when things go wrong
4. Validate each section before moving to the next

## Key Principles

- **One question at a time** — never dump a list of questions
- **Multiple choice preferred** — reduce cognitive load on the user
- **YAGNI ruthlessly** — cut anything that is not strictly needed for the initial version
- **Explore alternatives** — even if the first idea seems obvious, consider at least one other path
- **Incremental validation** — validate early, validate often

## After the Design: Write the Plan

**This step is mandatory.** Before any implementation begins, write a formal spec-driven development plan.

### Plan File

Write the plan to:

```
docs/plans/YYYYMMDD-<topic>-plan.md
```

Use today's date as `YYYYMMDD` (e.g., `20260311-user-invitations-plan.md`). The timestamp gives chronological progression when multiple plans exist.

### Plan Structure

```markdown
# <Feature Name>

## Context
What problem are we solving and why now.

## Decision
Which approach was chosen from the brainstorming phase and why.

## Scenarios

### Scenario 1: <Happy path>
GIVEN <precondition>
WHEN <action>
THEN <expected outcome>
AND <additional outcomes>

### Scenario 2: <Edge case or alternate flow>
GIVEN ...
WHEN ...
THEN ...

## Constraints
- Performance, compatibility, security, or other hard requirements
- What is explicitly out of scope for this iteration

## Implementation Notes
- Key technical choices made during brainstorming
- Dependencies or services involved
- Migration considerations (if touching existing code)
```

### After Writing

1. Save the plan file
2. Commit it to git: `docs/plans: add <topic> plan`
3. **Only then** proceed to implementation — the plan is the contract

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Jumping to code after brainstorming | Always write the plan file first — it is the contract for implementation |
| Asking too many questions at once | One question at a time, multiple-choice preferred |
| Only proposing one approach | Always propose 2-3 approaches with trade-offs, even if one is clearly better |
| Plan without GIVEN-WHEN-THEN scenarios | Scenarios are mandatory — they become acceptance criteria during implementation |
| Skipping edge cases in the design | Dedicate a section to "what happens when things go wrong" |
| Plan file without timestamp | Always use `YYYYMMDD` prefix for chronological ordering |
