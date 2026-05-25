// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Converts standard Markdown (LLM output) to Telegram MarkdownV2 format.
 *
 * Telegram MarkdownV2 requires escaping of special characters outside
 * of formatted entities. This module handles the conversion, stripping
 * unsupported constructs (tables, horizontal rules) and escaping properly.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */

/** Characters that must be escaped in MarkdownV2 outside of code blocks */
const SPECIAL_CHARS = /([_*[\]()~`>#+\-=|{}.!\\])/g;

function escapeV2(text: string): string {
  return text.replace(SPECIAL_CHARS, "\\$1");
}

/**
 * Convert standard Markdown to Telegram MarkdownV2.
 *
 * Handles: bold, italic, strikethrough, inline code, code blocks,
 * links, headings (→ bold), lists, blockquotes.
 * Converts tables to monospace code blocks, strips horizontal rules.
 */
export function toTelegramMarkdownV2(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (const line of lines) {
    // --- Code block toggle ---
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
        codeBlockLines = [];
      } else {
        // Close code block — content inside is NOT escaped in MarkdownV2
        const lang = codeBlockLang ? escapeV2(codeBlockLang) : "";
        const body = codeBlockLines.join("\n");
        result.push(`\`\`\`${lang}\n${body}\n\`\`\``);
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // --- Table detection → monospace code block ---
    if (/^\s*\|/.test(line)) {
      const cells = parseTableRow(line);
      if (cells) {
        // Skip separator rows (e.g. |---|---|)
        if (cells.every((c) => /^[-:]+$/.test(c))) {
          continue;
        }
        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      }
      continue;
    }
    if (tableHeaders.length > 0) {
      result.push(renderTableAsCodeBlock(tableHeaders, tableRows));
      tableHeaders = [];
      tableRows = [];
    }

    // --- Horizontal rule (strip) ---
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      continue;
    }

    // --- Headings → bold ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      result.push(`*${convertInline(headingMatch[2].trim())}*`);
      continue;
    }

    // --- Blockquote ---
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      result.push(`>${convertInline(quoteMatch[1])}`);
      continue;
    }

    // --- Unordered list ---
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      const indent = ulMatch[1];
      result.push(`${indent}• ${convertInline(ulMatch[2])}`);
      continue;
    }

    // --- Ordered list ---
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      result.push(`${olMatch[1]}${escapeV2(olMatch[2] + ".")} ${convertInline(olMatch[3])}`);
      continue;
    }

    // --- Regular line ---
    if (line.trim() === "") {
      result.push("");
    } else {
      result.push(convertInline(line));
    }
  }

  // Flush pending table
  if (tableHeaders.length > 0) {
    result.push(renderTableAsCodeBlock(tableHeaders, tableRows));
  }

  // Handle unclosed code block
  if (inCodeBlock) {
    const lang = codeBlockLang ? `${escapeV2(codeBlockLang)}\n` : "";
    const body = codeBlockLines.join("\n");
    const sep = body.length > 0 ? "\n" : "";
    result.push(`\`\`\`${lang}${body}${sep}\`\`\``);
  }

  return result.join("\n");
}

/**
 * Convert inline Markdown formatting to MarkdownV2.
 *
 * Processing order matters — we extract code spans and links first
 * (they contain special chars that must not be double-escaped),
 * then handle bold/italic/strikethrough on the remaining text.
 */
function convertInline(text: string): string {
  // Tokenize: split into code spans, links, and plain text segments
  const tokens: Array<{ type: "code" | "link" | "text"; value: string }> = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    // Link
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);

    // Pick whichever comes first
    const codeIdx = codeMatch ? codeMatch[1].length : Infinity;
    const linkIdx = linkMatch ? linkMatch[1].length : Infinity;

    if (codeIdx === Infinity && linkIdx === Infinity) {
      tokens.push({ type: "text", value: remaining });
      break;
    }

    if (codeIdx <= linkIdx && codeMatch) {
      if (codeMatch[1]) tokens.push({ type: "text", value: codeMatch[1] });
      tokens.push({ type: "code", value: codeMatch[2] });
      remaining = remaining.slice(codeMatch[0].length);
    } else if (linkMatch) {
      if (linkMatch[1]) tokens.push({ type: "text", value: linkMatch[1] });
      tokens.push({ type: "link", value: `[${escapeV2(linkMatch[2])}](${linkMatch[3]})` });
      remaining = remaining.slice(linkMatch[0].length);
    }
  }

  // Process each token
  return tokens
    .map((t) => {
      if (t.type === "code") return `\`${t.value}\``;
      if (t.type === "link") return t.value;
      return formatText(t.value);
    })
    .join("");
}

/**
 * Apply bold/italic/strikethrough formatting, then escape remaining text.
 *
 * Uses placeholders (\x01 / \x02) to prevent bold results from being
 * re-matched by the italic regex. These are replaced at the end.
 */
function formatText(text: string): string {
  // Bold+italic ***text*** → bold (Telegram doesn't nest well)
  let result = text.replace(/\*\*\*(.+?)\*\*\*/g, (_m, c) => `\x01${escapeV2(c)}\x01`);
  // Bold **text**
  result = result.replace(/\*\*(.+?)\*\*/g, (_m, c) => `\x01${escapeV2(c)}\x01`);
  // Italic *text* (single asterisk, not inside bold)
  result = result.replace(/(?<![\\*])\*([^*]+?)\*(?!\*)/g, (_m, c) => `\x02${escapeV2(c)}\x02`);
  // Strikethrough ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_m, c) => `~${escapeV2(c)}~`);

  // Escape remaining unformatted segments
  result = escapeUnformatted(result);

  // Restore placeholders to actual MarkdownV2 markers
  // eslint-disable-next-line no-control-regex -- sentinel chars intentionally used
  return result.replace(/\x01/g, "*").replace(/\x02/g, "_");
}

/**
 * Escape special characters in text segments that are NOT inside
 * MarkdownV2 formatting entities (*bold*, _italic_, ~strike~, `code`).
 */
/** Parse a markdown table row into trimmed cell values, or null if not a table row. */
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  // Split by |, drop first/last empty segments from leading/trailing |
  const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
  return cells.length > 0 ? cells : null;
}

/** Render table headers + rows as a pad-aligned monospace code block. */
function renderTableAsCodeBlock(headers: string[], rows: string[][]): string {
  const colCount = headers.length;

  // Calculate max width for each column
  const widths = headers.map((h) => stringWidth(h));
  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] ?? "";
      widths[i] = Math.max(widths[i] ?? 0, stringWidth(cell));
    }
  }

  const pad = (text: string, width: number) =>
    text + " ".repeat(Math.max(0, width - stringWidth(text)));

  const formatRow = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i] ?? 0)).join("  ");

  const lines = [formatRow(headers), ...rows.map(formatRow)];
  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

/**
 * Visual width of a string, accounting for emoji that take 2 columns.
 * Uses a simple heuristic: characters outside BMP (surrogate pairs) count as 2.
 */
function stringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
     
    width += ch.codePointAt(0)! > 0xffff ? 2 : 1;
  }
  return width;
}

function escapeUnformatted(text: string): string {
  // Match formatted spans (bold/italic use placeholders \x01/\x02, strike ~, code `)
  // eslint-disable-next-line no-control-regex -- sentinel chars intentionally used
  const entityPattern = /(\x01[^\x01]+\x01|\x02[^\x02]+\x02|~[^~]+~|`[^`]+`)/g;
  const parts = text.split(entityPattern);

  return parts
    .map((part) => {
      if (entityPattern.test(part)) {
        entityPattern.lastIndex = 0;
        return part;
      }
      entityPattern.lastIndex = 0;
      return escapeV2(part);
    })
    .join("");
}
