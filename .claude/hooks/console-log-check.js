#!/usr/bin/env node

/**
 * PostToolUse hook: Warn if console.log added to production TypeScript/JavaScript code.
 *
 * Receives tool metadata as JSON on stdin.
 * Outputs warnings to stderr (non-blocking).
 */

const fs = require("fs");
const path = require("path");

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const data = JSON.parse(input);
    const filePath = data.input?.file_path || data.input?.filePath || "";

    if (!filePath) return;

    const ext = path.extname(filePath);
    if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) return;

    // Skip test files
    if (
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes("__tests__")
    )
      return;

    // Skip config files
    const basename = path.basename(filePath);
    if (
      basename.startsWith("jest.") ||
      basename.startsWith("vitest.") ||
      basename.includes(".config.")
    )
      return;

    // Check for console.log in the file
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const findings = [];

      for (let i = 0; i < lines.length; i++) {
        if (/console\.(log|debug|info)\s*\(/.test(lines[i])) {
          // Skip if it's a comment
          const trimmed = lines[i].trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
          findings.push(i + 1);
        }
      }

      if (findings.length > 0) {
        process.stderr.write(
          `\n⚠️  console.log detected in ${path.basename(filePath)} (lines: ${findings.join(", ")})\n`
        );
        process.stderr.write(
          `   Use a structured logger instead of console.log in production code.\n`
        );
      }
    } catch {
      // File not readable — ignore
    }
  } catch {
    // JSON parse error — ignore
  }
}

main();
