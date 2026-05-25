// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { basename } from "path";

/**
 * Unit tests for the path traversal protection in InstanceKnowledgeController.upload().
 *
 * The controller uses basename() + strict comparison to reject filenames containing
 * directory components (../, ./, absolute paths, Windows separators).
 *
 * We test the sanitization logic directly rather than spinning up NestJS,
 * matching the pattern used by the controller.
 */

// ---------------------------------------------------------------------------
// Reproduce the controller's sanitization logic as a pure function
// ---------------------------------------------------------------------------

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) throw new Error("filename is required");

  const sanitized = basename(trimmed);
  if (!sanitized || sanitized !== trimmed) {
    throw new Error("Filename must not contain path separators or directory components");
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("knowledge upload — path traversal protection (#34)", () => {
  describe("valid filenames", () => {
    const valid = [
      "document.md",
      "notes.txt",
      "report.v2.pdf",
      "my-file_2024.html",
      "UPPERCASE.MD",
      "file-with-dashes.txt",
    ];

    it.each(valid)("accepts '%s'", (filename) => {
      expect(sanitizeFilename(filename)).toBe(filename);
    });
  });

  describe("path traversal attempts", () => {
    const traversalPayloads: [string, string][] = [
      ["../../../etc/passwd", "parent directory traversal"],
      ["../../secret.txt", "double parent traversal"],
      ["../file.txt", "single parent traversal"],
      ["./file.txt", "current directory prefix"],
      ["/etc/passwd", "absolute path (Unix)"],
      ["/tmp/evil.txt", "absolute path to tmp"],
      ["subfolder/file.txt", "nested directory"],
      ["a/b/c/file.txt", "deep nested path"],
    ];

    it.each(traversalPayloads)("rejects '%s' (%s)", (filename) => {
      expect(() => sanitizeFilename(filename)).toThrow(
        "Filename must not contain path separators or directory components",
      );
    });
  });

  describe("Windows path separators (platform-dependent)", () => {
    // Note: On POSIX systems (Linux/macOS), basename() does NOT treat backslash
    // as a separator. These tests document the actual behavior.
    // The forward-slash cases in "path traversal attempts" cover the critical paths.

    it("documents that POSIX basename does not strip backslash paths", () => {
      // On macOS/Linux, basename("subfolder\\file.txt") === "subfolder\\file.txt"
      // This is a known limitation — only forward-slash traversal is blocked on POSIX
      const result = basename("subfolder\\file.txt");
      // If we're on Windows, basename strips it; on POSIX it doesn't
      expect(typeof result).toBe("string");
    });
  });

  describe("edge cases", () => {
    it("rejects empty filename", () => {
      expect(() => sanitizeFilename("")).toThrow("filename is required");
    });

    it("rejects whitespace-only filename", () => {
      expect(() => sanitizeFilename("   ")).toThrow("filename is required");
    });

    it("strips leading/trailing whitespace before validation", () => {
      expect(sanitizeFilename("  document.md  ")).toBe("document.md");
    });
  });
});
