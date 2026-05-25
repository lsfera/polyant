// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { toTelegramMarkdownV2 } from "./markdown-v2.js";

describe("toTelegramMarkdownV2", () => {
  describe("escaping", () => {
    it("should escape special characters in plain text", () => {
      const result = toTelegramMarkdownV2("Price is 5.99$ (tax included)");
      // $ is not a MarkdownV2 special char, but . and () are
      expect(result).toContain("5\\.99$");
      expect(result).toContain("\\(tax included\\)");
    });

    it("should escape dots, hyphens, and equals", () => {
      const result = toTelegramMarkdownV2("file-name.ts = value");
      expect(result).toContain("file\\-name\\.ts \\= value");
    });
  });

  describe("headings", () => {
    it("should convert headings to bold", () => {
      expect(toTelegramMarkdownV2("# Title")).toBe("*Title*");
      expect(toTelegramMarkdownV2("## Subtitle")).toBe("*Subtitle*");
      expect(toTelegramMarkdownV2("### Deep")).toBe("*Deep*");
    });

    it("should escape special chars inside headings", () => {
      const result = toTelegramMarkdownV2("## Section (overview)");
      expect(result).toBe("*Section \\(overview\\)*");
    });
  });

  describe("bold and italic", () => {
    it("should convert **bold** to *bold*", () => {
      const result = toTelegramMarkdownV2("This is **bold** text");
      expect(result).toContain("*bold*");
    });

    it("should convert *italic* to _italic_", () => {
      const result = toTelegramMarkdownV2("This is *italic* text");
      expect(result).toContain("_italic_");
    });

    it("should convert ~~strikethrough~~ to ~strike~", () => {
      const result = toTelegramMarkdownV2("This is ~~deleted~~ text");
      expect(result).toContain("~deleted~");
    });
  });

  describe("inline code", () => {
    it("should preserve inline code without escaping contents", () => {
      const result = toTelegramMarkdownV2("Run `npm install` now");
      expect(result).toContain("`npm install`");
    });

    it("should not escape special chars inside inline code", () => {
      const result = toTelegramMarkdownV2("Use `file-name.ts` here");
      expect(result).toContain("`file-name.ts`");
    });
  });

  describe("code blocks", () => {
    it("should preserve code block content without escaping", () => {
      const input = "Before\n```typescript\nconst x = 1;\n```\nAfter";
      const result = toTelegramMarkdownV2(input);
      expect(result).toContain("```typescript\nconst x = 1;\n```");
    });

    it("should handle code blocks without language", () => {
      const input = "```\nplain code\n```";
      const result = toTelegramMarkdownV2(input);
      expect(result).toContain("```\nplain code\n```");
    });
  });

  describe("links", () => {
    it("should convert links with escaped text but unescaped URL", () => {
      const result = toTelegramMarkdownV2("See [the docs](https://example.com/path)");
      expect(result).toContain("[the docs](https://example.com/path)");
    });

    it("should escape special chars in link text", () => {
      const result = toTelegramMarkdownV2("[file.ts (main)](https://example.com)");
      expect(result).toContain("[file\\.ts \\(main\\)](https://example.com)");
    });
  });

  describe("lists", () => {
    it("should convert unordered lists to bullet points", () => {
      const result = toTelegramMarkdownV2("- Item one\n- Item two");
      expect(result).toBe("• Item one\n• Item two");
    });

    it("should convert ordered lists", () => {
      const result = toTelegramMarkdownV2("1. First\n2. Second");
      expect(result).toContain("1\\.");
      expect(result).toContain("First");
    });
  });

  describe("blockquotes", () => {
    it("should preserve blockquote format", () => {
      const result = toTelegramMarkdownV2("> This is a quote");
      expect(result).toBe(">This is a quote");
    });
  });

  describe("tables (monospace code block)", () => {
    it("should convert a simple table to a code block", () => {
      const input = [
        "| Header 1 | Header 2 |",
        "|----------|----------|",
        "| Cell 1   | Cell 2   |",
      ].join("\n");
      const result = toTelegramMarkdownV2(input);
      expect(result).toContain("```");
      expect(result).toContain("Header 1");
      expect(result).toContain("Cell 1");
      // No pipes in the code block output
      expect(result).not.toContain("|");
    });

    it("should pad columns to align", () => {
      const input = [
        "| Name | Description |",
        "|------|-------------|",
        "| A    | Short       |",
        "| Longer | A much longer value |",
      ].join("\n");
      const result = toTelegramMarkdownV2(input);
      const codeContent = result.match(/```\n([\s\S]+?)\n```/)?.[1] ?? "";
      const lines = codeContent.split("\n");
      // Header and both rows present
      expect(lines).toHaveLength(3);
      // All lines padded to same structure (Longer is longest in col 1)
      expect(lines[0]).toContain("Name");
      expect(lines[2]).toContain("Longer");
    });

    it("should preserve surrounding content", () => {
      const input = [
        "Before table",
        "| H1 | H2 |",
        "|----|-----|",
        "| A  | B   |",
        "After table",
      ].join("\n");
      const result = toTelegramMarkdownV2(input);
      expect(result).toMatch(/Before table/);
      expect(result).toMatch(/After table/);
      expect(result).toContain("```");
    });

    it("should handle table at end of input (no trailing content)", () => {
      const input = [
        "| X | Y |",
        "|---|---|",
        "| 1 | 2 |",
      ].join("\n");
      const result = toTelegramMarkdownV2(input);
      expect(result).toContain("```");
      expect(result).toContain("X");
      expect(result).toContain("1");
    });

    it("should handle emoji in cells", () => {
      const input = [
        "| Status | Issue |",
        "|--------|-------|",
        "| 🔴 HIGH | #27  |",
      ].join("\n");
      const result = toTelegramMarkdownV2(input);
      expect(result).toContain("🔴 HIGH");
      expect(result).toContain("#27");
    });
  });

  describe("horizontal rules (strip)", () => {
    it("should strip horizontal rules", () => {
      const result = toTelegramMarkdownV2("Above\n---\nBelow");
      expect(result).not.toContain("---");
      expect(result).toContain("Above");
      expect(result).toContain("Below");
    });
  });

  describe("complex real-world message", () => {
    it("should handle the security review message pattern", () => {
      const input = [
        "# Security Review",
        "**Date:** April 10, 2026",
        "",
        "## Findings",
        "",
        "| Priority | Title |",
        "|----------|--------|",
        "| HIGH | SSRF in url-safety.ts |",
        "",
        "### Detail",
        "- Issue #26: DELETE /memories/:id without check",
        "- Issue #27: Sensitive env vars",
        "",
        "---",
        "",
        "**Recommendation:** address the HIGH issues.",
      ].join("\n");

      const result = toTelegramMarkdownV2(input);
      // Should not throw and should produce valid text
      expect(result).toBeTruthy();
      // Tables converted to code blocks, separator rows removed
      expect(result).not.toContain("---|");
      expect(result).toContain("```");
      // Headings converted to bold
      expect(result).toContain("*Security Review*");
      expect(result).toContain("*Findings*");
      // Lists preserved
      expect(result).toContain("•");
    });
  });
});
