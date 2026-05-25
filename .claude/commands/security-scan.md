---
description: "Use this for a dedicated security review of the codebase. Runs OWASP scan, secret detection, dependency audit."
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
---

# /security-scan — Security Review

## Agent
Delegate to: `.claude/agents/security-reviewer.md`

## Workflow

### Step 1: Scope
Determine what to scan:
- **Full scan**: entire codebase
- **Diff scan**: only changed files (`git diff main...HEAD`)
- **Targeted scan**: specific directories/files

### Step 2: OWASP Top 10 Scan
For each file in scope, check against all 10 categories:
A01 (Access Control), A02 (Crypto), A03 (Injection), A04 (Insecure Design),
A05 (Misconfiguration), A06 (Vulnerable Components), A07 (Auth Failures),
A08 (Data Integrity), A09 (Logging), A10 (SSRF)

### Step 3: Secret Scanning
Search for hardcoded secrets:
```bash
# Common patterns
grep -rn "sk-\|pk_\|AKIA\|password=\|secret=\|token=\|api_key=" --include="*.ts" --include="*.py" --include="*.js" --include="*.env*"
```
- Check `.env` in `.gitignore`
- Check git history for leaked secrets

### Step 4: Dependency Audit
```bash
# Node.js
npm audit

# Python
pip audit / safety check

# Check for outdated dependencies
npm outdated / pip list --outdated
```

### Step 5: Report

```markdown
# Security Scan Report
Date: YYYY-MM-DD
Scope: [full / diff / targeted]

## Summary
- Critical: N
- High: N
- Medium: N
- Low: N

## Findings
[SEVERITY] CWE-XXX — Description
  Location: file:line
  Impact: [what an attacker could do]
  Fix: [specific remediation]

## Dependency Vulnerabilities
| Package | Version | CVE | Severity | Fix Version |
|---------|---------|-----|----------|-------------|

## Recommendations
1. [Priority action items]
```
