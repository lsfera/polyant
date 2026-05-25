// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { toWhatsAppText } from "./whatsapp-format.js";

describe("toWhatsAppText", () => {
  describe("headings", () => {
    it("converts all heading levels to bold", () => {
      expect(toWhatsAppText("# Title")).toBe("*Title*");
      expect(toWhatsAppText("## Section")).toBe("*Section*");
      expect(toWhatsAppText("### Sub")).toBe("*Sub*");
      expect(toWhatsAppText("###### Deepest")).toBe("*Deepest*");
    });
  });

  describe("inline formatting", () => {
    it("converts bold from double to single asterisk", () => {
      expect(toWhatsAppText("**bold text**")).toBe("*bold text*");
    });

    it("converts bold from double underscore to asterisk", () => {
      expect(toWhatsAppText("__bold text__")).toBe("*bold text*");
    });

    it("converts italic from single asterisk to underscore", () => {
      expect(toWhatsAppText("*italic text*")).toBe("_italic text_");
    });

    it("preserves italic already in underscore form", () => {
      expect(toWhatsAppText("_italic text_")).toBe("_italic text_");
    });

    it("converts strikethrough from double to single tilde", () => {
      expect(toWhatsAppText("~~deleted~~")).toBe("~deleted~");
    });

    it("handles bold and italic together", () => {
      expect(toWhatsAppText("**bold** and *italic*")).toBe("*bold* and _italic_");
    });

    it("does not mistake bold for italic", () => {
      // **x** must not end up double-converted as _*x*_
      expect(toWhatsAppText("**x**")).toBe("*x*");
    });

    it("collapses triple-asterisk bold+italic to bold", () => {
      expect(toWhatsAppText("***emphasis***")).toBe("*emphasis*");
    });
  });

  describe("code", () => {
    it("preserves inline code", () => {
      expect(toWhatsAppText("use `npm install`")).toBe("use `npm install`");
    });

    it("strips language tag from code blocks", () => {
      const input = "```typescript\nconst x = 1;\n```";
      expect(toWhatsAppText(input)).toBe("```const x = 1;```");
    });

    it("does not convert formatting inside inline code", () => {
      expect(toWhatsAppText("`**not bold**`")).toBe("`**not bold**`");
    });

    it("does not convert formatting inside code block", () => {
      const input = "```\n**keep this literal**\n```";
      expect(toWhatsAppText(input)).toBe("```**keep this literal**```");
    });
  });

  describe("links", () => {
    it("converts link with different label to label + url", () => {
      expect(toWhatsAppText("[Example](https://example.com)")).toBe("Example (https://example.com)");
    });

    it("emits only the url when label equals url", () => {
      expect(toWhatsAppText("[https://example.com](https://example.com)")).toBe("https://example.com");
    });

    it("handles links inside running text", () => {
      expect(toWhatsAppText("visit [site](https://example.com) now")).toBe(
        "visit site (https://example.com) now",
      );
    });
  });

  describe("lists", () => {
    it("converts unordered lists with dash", () => {
      const input = "- one\n- two\n- three";
      expect(toWhatsAppText(input)).toBe("- one\n- two\n- three");
    });

    it("normalizes unordered lists with asterisk to dash", () => {
      const input = "* one\n* two";
      expect(toWhatsAppText(input)).toBe("- one\n- two");
    });

    it("preserves ordered lists", () => {
      const input = "1. first\n2. second";
      expect(toWhatsAppText(input)).toBe("1. first\n2. second");
    });

    it("applies inline formatting inside list items", () => {
      expect(toWhatsAppText("- **bold** item")).toBe("- *bold* item");
    });
  });

  describe("blockquotes", () => {
    it("preserves blockquote marker", () => {
      expect(toWhatsAppText("> quoted text")).toBe("> quoted text");
    });

    it("applies inline formatting inside blockquote", () => {
      expect(toWhatsAppText("> **important** note")).toBe("> *important* note");
    });
  });

  describe("horizontal rule", () => {
    it("strips horizontal rules with dashes", () => {
      expect(toWhatsAppText("before\n---\nafter")).toBe("before\nafter");
    });

    it("strips horizontal rules with underscores", () => {
      expect(toWhatsAppText("before\n___\nafter")).toBe("before\nafter");
    });
  });

  describe("tables", () => {
    it("renders a simple table as monospace code block", () => {
      const input = "| Col1 | Col2 |\n|------|------|\n| a    | b    |\n| ccc  | ddd  |";
      const out = toWhatsAppText(input);
      expect(out.startsWith("```")).toBe(true);
      expect(out.endsWith("```")).toBe(true);
      expect(out).toContain("Col1");
      expect(out).toContain("Col2");
      expect(out).toContain("a");
      expect(out).toContain("ccc");
      expect(out).toContain("ddd");
    });
  });

  describe("complex integration", () => {
    it("handles mixed document with headings, bold, italic, list, link", () => {
      const input = [
        "# Report",
        "",
        "This is **important** and _noteworthy_.",
        "",
        "- Visit [our site](https://example.com)",
        "- Read `docs.md`",
      ].join("\n");

      const out = toWhatsAppText(input);
      expect(out).toContain("*Report*");
      expect(out).toContain("*important*");
      expect(out).toContain("_noteworthy_");
      expect(out).toContain("- Visit our site (https://example.com)");
      expect(out).toContain("- Read `docs.md`");
    });

    it("preserves empty lines between blocks", () => {
      const input = "*hello*\n\n*world*";
      expect(toWhatsAppText(input)).toBe("_hello_\n\n_world_");
    });
  });
});
