---
description: "Enforce git workflow: atomic commits, branch strategy, PR hygiene"
globs: ["**/*"]
alwaysApply: true
---

# Git Workflow Rules

## MUST (violations block PR)

### Commits
- Commits MUST be atomic: one commit = one logical change
- Commit messages in English, format: `type(scope): description` (conventional commits)
- Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
- Never commit: `.env`, `node_modules/`, `__pycache__/`, `.DS_Store`, build artifacts
- Never commit generated files (lockfiles excluded — those must be committed)

### Branches
- Feature branch from `main`: `feat/<short-description>`
- Bugfix branch: `fix/<short-description>`
- Never push directly to `main`/`master` — always via PR
- Branch names in kebab-case, max 50 characters

### Pull Requests
- PR title follows conventional commits: `feat(scope): description`
- PR MUST have a description: what changes, why, how to test
- PR MUST pass CI (lint, test, build) before merge
- Review required for production code

## SHOULD (warnings)

- Squash merge for feature branches (clean history)
- Rebase onto main before merge (avoid useless merge commits)
- PR ≤400 lines of code changed (excluding generated/lock files)
- Draft PR for work-in-progress (signals it's not ready for review)
- Link issue/ticket in the PR description
