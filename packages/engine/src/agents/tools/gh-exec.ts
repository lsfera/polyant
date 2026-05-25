// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "child_process";
import { safeEnv } from "./safe-env.js";

const GH_TIMEOUT_MS = 30_000;

export interface GhExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a `gh` CLI command with GH_TOKEN auth.
 * Returns raw stdout/stderr and exit code.
 */
export async function ghExec(
  args: string[],
  token: string,
  timeoutMs: number = GH_TIMEOUT_MS,
): Promise<GhExecResult> {
  return new Promise((resolve) => {
    execFile(
      "gh",
      args,
      {
        env: safeEnv({ GH_TOKEN: token }),
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024, // 5MB for large diffs
      },
      (error, stdout, stderr) => {
        if (error && "killed" in error && error.killed) {
          resolve({ stdout: "", stderr: "Command timed out", exitCode: 124 });
          return;
        }
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode:
            error && "code" in error && typeof error.code === "number"
              ? error.code
              : error
                ? 1
                : 0,
        });
      },
    );
  });
}

/**
 * Execute `gh` and parse JSON output. Returns parsed object or error string.
 */
export async function ghJson<T = unknown>(
  args: string[],
  token: string,
): Promise<{ data: T } | { error: string }> {
  const result = await ghExec(args, token);
  if (result.exitCode !== 0) {
    return { error: result.stderr || `gh exited with code ${result.exitCode}` };
  }
  try {
    return { data: JSON.parse(result.stdout) as T };
  } catch {
    return { data: result.stdout as unknown as T };
  }
}
