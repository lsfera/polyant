// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Converts standard Markdown (LLM output) to WhatsApp's native formatting.
 *
 * WhatsApp supports a limited subset of inline formatting:
 * - Bold:          *text*      (single asterisk)
 * - Italic:        _text_      (single underscore)
 * - Strikethrough: ~text~      (single tilde)
 * - Inline code:   `text`
 * - Code block:    ```text```
 * - Blockquote:    > text
 * - Bulleted list: - item  or  * item
 * - Numbered list: 1. item
 *
 * WhatsApp does NOT support Markdown link syntax: `[text](url)` is rendered
 * verbatim. We downgrade it to `text (url)` (or just the URL when text == url),
 * relying on WhatsApp's automatic URL linkification for plain-text URLs.
 *
 * Headings and horizontal rules have no native representation: headings are
 * rendered as bold, horizontal rules are stripped. Tables are rendered as a
 * monospace code block (same approach used by the Telegram adapter).
 *
 * No character escaping is needed — unmatched markers are shown literally
 * by WhatsApp without breaking the message (unlike Telegram MarkdownV2).
 */

export function toWhatsAppText(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (const line of lines) {
    // --- Code block toggle ---
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
      } else {
        // WhatsApp code blocks don't support language tags
        const body = codeBlockLines.join("\n");
        result.push(`\`\`\`${body}\`\`\``);
        inCodeBlock = false;
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
        if (cells.every((c) => /^[-:]+$/.test(c))) continue;
        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      }
      continue;
    }
    if (tableHeaders.length > 0) {
      result.push(renderTableAsMonospace(tableHeaders, tableRows));
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
      result.push(`> ${convertInline(quoteMatch[1])}`);
      continue;
    }

    // --- Unordered list ---
    // Normalize `*` / `+` bullets to `-` so the inline formatter never
    // mistakes `* text` for an italic/bold span.
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      result.push(`${ulMatch[1]}- ${convertInline(ulMatch[2])}`);
      continue;
    }

    // --- Ordered list ---
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      result.push(`${olMatch[1]}${olMatch[2]}. ${convertInline(olMatch[3])}`);
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
    result.push(renderTableAsMonospace(tableHeaders, tableRows));
  }

  // Handle unclosed code block
  if (inCodeBlock) {
    const body = codeBlockLines.join("\n");
    result.push(`\`\`\`${body}\`\`\``);
  }

  return result.join("\n");
}

/**
 * Convert inline Markdown formatting to WhatsApp format.
 *
 * Processing order: code spans → links → bold/italic/strikethrough.
 * Code spans and links are extracted first so their contents aren't
 * misinterpreted by the formatting regexes.
 */
function convertInline(text: string): string {
  const tokens: Array<{ type: "code" | "link" | "text"; value: string }> = [];
  let remaining = text;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);

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
      const linkText = linkMatch[2];
      const url = linkMatch[3];
      // WhatsApp auto-links bare URLs; if the label matches the URL, emit
      // just the URL so the user sees a single clickable link.
      const rendered = linkText.trim() === url.trim() ? url : `${linkText} (${url})`;
      tokens.push({ type: "link", value: rendered });
      remaining = remaining.slice(linkMatch[0].length);
    }
  }

  return tokens
    .map((t) => {
      if (t.type === "code") return `\`${t.value}\``;
      if (t.type === "link") return t.value;
      return formatText(t.value);
    })
    .join("");
}

/**
 * Apply bold/italic/strikethrough conversion for WhatsApp.
 *
 * Markdown → WhatsApp:
 * - **bold**   → *bold*
 * - __bold__   → *bold*
 * - *italic*   → _italic_
 * - _italic_   → _italic_  (already in WhatsApp form)
 * - ~~strike~~ → ~strike~
 *
 * Uses \x01 / \x02 placeholders to prevent converted bold markers
 * from being re-matched by the italic regex.
 */
function formatText(text: string): string {
  // Bold+italic ***text*** → bold (WhatsApp doesn't nest these well)
  let result = text.replace(/\*\*\*(.+?)\*\*\*/g, "\x01$1\x01");
  // Bold **text** → placeholder
  result = result.replace(/\*\*(.+?)\*\*/g, "\x01$1\x01");
  // Bold __text__ → placeholder
  result = result.replace(/__(.+?)__/g, "\x01$1\x01");
  // Italic *text* → _text_ (single asterisk not inside bold)
  result = result.replace(/(?<![\\*])\*([^*\n]+?)\*(?!\*)/g, "\x02$1\x02");
  // Strikethrough ~~text~~ → ~text~
  result = result.replace(/~~(.+?)~~/g, "~$1~");

  // Restore placeholders
  // eslint-disable-next-line no-control-regex -- sentinel chars intentionally used
  return result.replace(/\x01/g, "*").replace(/\x02/g, "_");
}

/** Parse a markdown table row into trimmed cell values, or null if not a table row. */
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
  return cells.length > 0 ? cells : null;
}

/** Render table headers + rows as a pad-aligned monospace code block. */
function renderTableAsMonospace(headers: string[], rows: string[][]): string {
  const colCount = headers.length;
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
  return `\`\`\`${lines.join("\n")}\`\`\``;
}

/**
 * Visual width of a string, accounting for characters outside the BMP
 * (typically emoji) which render as two columns in most monospace fonts.
 */
function stringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    width += ch.codePointAt(0)! > 0xffff ? 2 : 1;
  }
  return width;
}
