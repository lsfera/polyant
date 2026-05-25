// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Converts standard Markdown (LLM output) to Slack mrkdwn format.
 *
 * Slack mrkdwn differences from standard Markdown:
 * - Bold: *text* (single asterisk, not double)
 * - Italic: _text_ (same)
 * - Strikethrough: ~text~ (single tilde, not double)
 * - Code: `code` / ```block``` (same)
 * - Links: <url|text> (not [text](url))
 * - No heading support — convert to bold
 * - No special character escaping needed (unlike Telegram MarkdownV2)
 *
 * @see https://api.slack.com/reference/surfaces/formatting
 */

/**
 * Convert standard Markdown to Slack mrkdwn.
 *
 * Handles: bold, italic, strikethrough, inline code, code blocks,
 * links, headings (→ bold), lists, blockquotes.
 * Converts tables to monospace code blocks, strips horizontal rules.
 */
export function toSlackMrkdwn(markdown: string): string {
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
        // Slack code blocks don't support language tags
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
      result.push(renderTableAsNestedList(tableHeaders, tableRows));
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
      result.push(`${ulMatch[1]}• ${convertInline(ulMatch[2])}`);
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
    result.push(renderTableAsNestedList(tableHeaders, tableRows));
  }

  // Handle unclosed code block
  if (inCodeBlock) {
    const body = codeBlockLines.join("\n");
    const sep = body.length > 0 ? "\n" : "";
    result.push(`\`\`\`${body}${sep}\`\`\``);
  }

  return result.join("\n");
}

/**
 * Convert inline Markdown formatting to Slack mrkdwn.
 *
 * Processing order: code spans → links → bold/italic/strikethrough.
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
      // Slack link format: <url|text>
      tokens.push({ type: "link", value: `<${linkMatch[3]}|${linkMatch[2]}>` });
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
 * Apply bold/italic/strikethrough conversion for Slack mrkdwn.
 *
 * Markdown → Slack:
 * - **bold** → *bold*
 * - *italic* → _italic_
 * - ~~strike~~ → ~strike~
 *
 * Uses \x01 placeholders to prevent bold results from being
 * re-matched by the italic regex.
 */
function formatText(text: string): string {
  // Bold+italic ***text*** → bold (Slack doesn't nest these well)
  let result = text.replace(/\*\*\*(.+?)\*\*\*/g, "\x01$1\x01");
  // Bold **text** → *text* (placeholder to avoid italic re-match)
  result = result.replace(/\*\*(.+?)\*\*/g, "\x01$1\x01");
  // Italic *text* → _text_ (single asterisk not already matched by bold)
  result = result.replace(/(?<![\\*])\*([^*]+?)\*(?!\*)/g, "_$1_");
  // Strikethrough ~~text~~ → ~text~
  result = result.replace(/~~(.+?)~~/g, "~$1~");
  // Restore bold placeholders to actual Slack bold markers
  // eslint-disable-next-line no-control-regex -- sentinel char intentionally used to avoid re-matching
  return result.replace(/\x01/g, "*");
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
  return cells.length > 0 ? cells : null;
}

/** Render table as nested list: header as bold label, cells as sub-items. */
function renderTableAsNestedList(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  for (const row of rows) {
    const pairs = headers
      .map((h, i) => {
        const cell = row[i]?.trim();
        return cell ? `    • *${h}:* ${cell}` : null;
      })
      .filter(Boolean);
    if (pairs.length > 0) {
      // Use first cell as top-level bullet
      lines.push(`• ${row[0]?.trim() ?? ""}`);
      // Remaining headers as nested items (skip first, already used as label)
      for (let i = 1; i < headers.length; i++) {
        const cell = row[i]?.trim();
        if (cell) lines.push(`    • *${headers[i]}:* ${cell}`);
      }
    }
  }
  return lines.join("\n");
}
