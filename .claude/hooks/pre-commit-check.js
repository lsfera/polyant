#!/usr/bin/env node

/**
 * PreToolUse hook: Block commits containing hardcoded secrets.
 *
 * Receives tool metadata as JSON on stdin.
 * Exit 0 = allow, Exit 2 = block.
 * Outputs blocking reason to stderr.
 */

const { execSync } = require("child_process");

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: "OpenAI API Key" },
  { pattern: /sk_live_[a-zA-Z0-9]+/, label: "Stripe Live Key" },
  { pattern: /AKIA[A-Z0-9]{16}/, label: "AWS Access Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: "GitHub Personal Access Token" },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]+/, label: "Slack Token" },
  {
    pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
    label: "Private Key",
  },
  {
    pattern: /password\s*[:=]\s*["'][^"']{8,}["']/i,
    label: "Hardcoded Password",
  },
];

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const data = JSON.parse(input);
    const command = data.input?.command || "";

    // Only check git commit commands
    if (!command.includes("git commit")) {
      process.exit(0);
    }

    // Check staged files for secrets
    let stagedDiff;
    try {
      stagedDiff = execSync("git diff --cached", {
        encoding: "utf-8",
        timeout: 5000,
      });
    } catch {
      process.exit(0); // can't get diff — allow
    }

    const findings = [];
    for (const { pattern, label } of SECRET_PATTERNS) {
      if (pattern.test(stagedDiff)) {
        findings.push(label);
      }
    }

    if (findings.length > 0) {
      process.stderr.write(
        `\n⛔ BLOCKED: Potential secrets detected in staged changes:\n`
      );
      for (const finding of findings) {
        process.stderr.write(`   - ${finding}\n`);
      }
      process.stderr.write(
        `\nRemove secrets before committing. Use environment variables instead.\n`
      );
      process.exit(2); // Block the commit
    }
  } catch {
    // Parse error — allow (non-blocking)
  }

  process.exit(0);
}

main();
