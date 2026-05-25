#!/usr/bin/env node

/**
 * PostToolUse hook: Auto-lint after file edits.
 * Runs the appropriate linter based on file extension.
 *
 * Receives tool metadata as JSON on stdin.
 * Outputs warnings to stderr (non-blocking).
 */

const { execSync } = require("child_process");
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

    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      try {
        execSync(`npx eslint --fix "${filePath}" 2>/dev/null`, {
          timeout: 10000,
          stdio: "pipe",
        });
      } catch {
        // eslint not available or failed — non-blocking
      }
    }

    if (ext === ".py") {
      try {
        execSync(`ruff format "${filePath}" 2>/dev/null`, {
          timeout: 10000,
          stdio: "pipe",
        });
      } catch {
        try {
          execSync(`black "${filePath}" 2>/dev/null`, {
            timeout: 10000,
            stdio: "pipe",
          });
        } catch {
          // no formatter available — non-blocking
        }
      }
    }
  } catch {
    // JSON parse error or other issue — silently ignore
  }
}

main();
