// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseFrontmatter, normalizeRequiredEnv, castPrimitive } from "./frontmatter.js";

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------
describe("parseFrontmatter", () => {
  it("parses basic key:value pairs", () => {
    const input = `---\ntitle: Hello World\nauthor: Jane\n---\nBody text`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.title).toBe("Hello World");
    expect(result!.meta.author).toBe("Jane");
  });

  it("returns null when input has no frontmatter delimiters", () => {
    expect(parseFrontmatter("Just plain text")).toBeNull();
    expect(parseFrontmatter("title: something\n---\n")).toBeNull();
  });

  it("returns null when the closing delimiter is missing", () => {
    expect(parseFrontmatter("---\ntitle: Hello\nNo closing")).toBeNull();
  });

  it("parses string list items (  - item)", () => {
    const input = `---\ntags:\n  - alpha\n  - beta\n  - gamma\n---\n`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.tags).toEqual(["alpha", "beta", "gamma"]);
  });

  it("parses object list items with 4-space indent continuation", () => {
    const input = [
      "---",
      "items:",
      "  - name: first",
      "    sensitive: false",
      "  - name: second",
      "    description: desc2",
      "    sensitive: true",
      "---",
      "Body",
    ].join("\n");

    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.items).toEqual([
      { name: "first", sensitive: false },
      { name: "second", description: "desc2", sensitive: true },
    ]);
  });

  it("extracts the body after the closing ---", () => {
    const input = `---\nkey: value\n---\nThis is the body.\nSecond line.`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.body).toBe("This is the body.\nSecond line.");
  });

  it("handles multiple top-level keys", () => {
    const input = `---\na: 1\nb: 2\nc: 3\n---\n`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.a).toBe("1");
    expect(result!.meta.b).toBe("2");
    expect(result!.meta.c).toBe("3");
  });

  it("returns null for empty frontmatter (no content between delimiters)", () => {
    // `---\n---` has the closing `\n---` at index 3, but search starts at 4, so it's not found
    const input = `---\n---\nBody only`;
    const result = parseFrontmatter(input);
    expect(result).toBeNull();
  });

  it("returns empty meta when frontmatter has only a blank line", () => {
    const input = `---\n\n---\nBody only`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta).toEqual({});
    expect(result!.body).toBe("Body only");
  });

  it("handles Windows-style line endings (\\r\\n)", () => {
    const input = "---\r\ntitle: Win\r\nauthor: Test\r\n---\r\nBody here";
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.title).toBe("Win");
    expect(result!.meta.author).toBe("Test");
    expect(result!.body).toBe("Body here");
  });

  it("strips only one leading newline from the body", () => {
    const input = `---\nkey: val\n---\n\nParagraph after blank line.`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    // The regex `.replace(/^\r?\n/, "")` removes one leading newline, second stays
    expect(result!.body).toBe("\nParagraph after blank line.");
  });

  it("handles a list item that contains a colon but no continuation (flat string)", () => {
    const input = `---\nnotes:\n  - key: value\n---\n`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    // When there is no 4-space indented continuation line, "key: value" is kept as a flat string
    expect(result!.meta.notes).toEqual(["key: value"]);
  });

  it("flushes a pending object when a new top-level key appears", () => {
    const input = [
      "---",
      "items:",
      "  - name: only",
      "    desc: one",
      "other: val",
      "---",
      "",
    ].join("\n");

    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    expect(result!.meta.items).toEqual([{ name: "only", desc: "one" }]);
    expect(result!.meta.other).toBe("val");
  });

  it("casts primitive values inside object list items", () => {
    const input = [
      "---",
      "entries:",
      "  - count: 42",
      "    active: true",
      "    deleted: false",
      "---",
      "",
    ].join("\n");

    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    const entries = result!.meta.entries as Record<string, unknown>[];
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(42);
    expect(entries[0].active).toBe(true);
    expect(entries[0].deleted).toBe(false);
  });

  it("handles keys with no value (list follows on next lines)", () => {
    const input = `---\ncolors:\n  - red\n  - blue\n---\n`;
    const result = parseFrontmatter(input);
    expect(result).not.toBeNull();
    // "colors:" has no inline value, so meta should not have a stale scalar
    expect(result!.meta.colors).toEqual(["red", "blue"]);
  });
});

// ---------------------------------------------------------------------------
// normalizeRequiredEnv
// ---------------------------------------------------------------------------
describe("normalizeRequiredEnv", () => {
  it("converts a string array to entries with sensitive=true", () => {
    const result = normalizeRequiredEnv(["API_KEY", "SECRET"]);
    expect(result).toEqual([
      { name: "API_KEY", sensitive: true },
      { name: "SECRET", sensitive: true },
    ]);
  });

  it("accepts an object array with name, description, and sensitive", () => {
    const result = normalizeRequiredEnv([
      { name: "DB_URL", description: "Database connection string", sensitive: true },
    ]);
    expect(result).toEqual([
      { name: "DB_URL", description: "Database connection string", sensitive: true },
    ]);
  });

  it("handles a mixed array of strings and objects", () => {
    const result = normalizeRequiredEnv([
      "TOKEN",
      { name: "HOST", description: "Hostname", sensitive: false },
    ]);
    expect(result).toEqual([
      { name: "TOKEN", sensitive: true },
      { name: "HOST", description: "Hostname", sensitive: false },
    ]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeRequiredEnv(null)).toEqual([]);
    expect(normalizeRequiredEnv(undefined)).toEqual([]);
    expect(normalizeRequiredEnv("string")).toEqual([]);
    expect(normalizeRequiredEnv(42)).toEqual([]);
    expect(normalizeRequiredEnv({})).toEqual([]);
  });

  it("filters out objects without a `name` property", () => {
    const result = normalizeRequiredEnv([
      { description: "no name here" },
      { name: "VALID" },
    ]);
    expect(result).toEqual([{ name: "VALID", sensitive: true }]);
  });

  it("defaults sensitive to true when not specified in an object", () => {
    const result = normalizeRequiredEnv([{ name: "KEY" }]);
    expect(result).toEqual([{ name: "KEY", sensitive: true }]);
  });

  it("preserves sensitive: false", () => {
    const result = normalizeRequiredEnv([{ name: "PUBLIC", sensitive: false }]);
    expect(result).toEqual([{ name: "PUBLIC", sensitive: false }]);
  });

  it("sets description to undefined when it is falsy", () => {
    const result = normalizeRequiredEnv([{ name: "X", description: "" }]);
    expect(result[0].name).toBe("X");
    expect(result[0].sensitive).toBe(true);
    expect(result[0].description).toBeUndefined();
  });

  it("coerces name to string via String()", () => {
    const result = normalizeRequiredEnv([{ name: 123 }]);
    expect(result).toEqual([{ name: "123", sensitive: true }]);
  });

  it("filters out non-string, non-object items (e.g. numbers, null)", () => {
    const result = normalizeRequiredEnv([null, 42, true, "VALID"]);
    expect(result).toEqual([{ name: "VALID", sensitive: true }]);
  });
});

// ---------------------------------------------------------------------------
// castPrimitive
// ---------------------------------------------------------------------------
describe("castPrimitive", () => {
  it('casts "true" to boolean true', () => {
    expect(castPrimitive("true")).toBe(true);
  });

  it('casts "false" to boolean false', () => {
    expect(castPrimitive("false")).toBe(false);
  });

  it('casts "42" to number 42', () => {
    expect(castPrimitive("42")).toBe(42);
  });

  it('casts "3.14" to number 3.14', () => {
    expect(castPrimitive("3.14")).toBe(3.14);
  });

  it("returns a regular string unchanged", () => {
    expect(castPrimitive("hello")).toBe("hello");
  });

  it("returns an empty string unchanged (stays string)", () => {
    expect(castPrimitive("")).toBe("");
    expect(typeof castPrimitive("")).toBe("string");
  });

  it('casts "0" to number 0', () => {
    expect(castPrimitive("0")).toBe(0);
  });

  it("casts negative numbers", () => {
    expect(castPrimitive("-5")).toBe(-5);
  });

  it('casts "NaN" string — stays as string because isNaN(Number("NaN")) is true', () => {
    // Number("NaN") is NaN, and isNaN(NaN) is true, so the condition fails
    expect(castPrimitive("NaN")).toBe("NaN");
  });

  it('casts "Infinity" to number Infinity', () => {
    // Number("Infinity") is Infinity, and isNaN(Infinity) is false
    expect(castPrimitive("Infinity")).toBe(Infinity);
  });
});
