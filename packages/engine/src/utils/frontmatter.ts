// SPDX-License-Identifier: AGPL-3.0-or-later

// ---------------------------------------------------------------------------
// Shared frontmatter parser + RequiredEnv normalizer
// ---------------------------------------------------------------------------

export interface RequiredEnvEntry {
  name: string;
  description?: string;
  sensitive: boolean;
}

/** Normalize requiredEnv from frontmatter: supports both string[] and object[] formats. */
export function normalizeRequiredEnv(raw: unknown): RequiredEnvEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { name: item, sensitive: true };
      }
      if (typeof item === "object" && item !== null && "name" in item) {
        return {
          name: String(item.name),
          description: item.description ? String(item.description) : undefined,
          sensitive: item.sensitive !== false, // default true
        };
      }
      return null;
    })
    .filter((x): x is RequiredEnvEntry => x !== null);
}

/**
 * Lightweight frontmatter parser. Handles `key: value`, `key:\n  - item` (flat
 * string lists) and `key:\n  - k: v\n    k2: v2` (object lists).
 * Returns null if no frontmatter delimiters found.
 */
export function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } | null {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return null;
  const endIdx = raw.indexOf("\n---", 4);
  if (endIdx === -1) return null;

  const yamlBlock = raw.slice(4, endIdx);
  const body = raw.slice(endIdx + 4).replace(/^\r?\n/, "");
  const meta: Record<string, unknown> = {};
  let currentKey = "";
  let currentObj: Record<string, unknown> | null = null;

  const lines = yamlBlock.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();

    if (trimmed.startsWith("  - ") && currentKey) {
      // Flush any pending object from the previous list item
      if (currentObj) {
        const arr = (meta[currentKey] as unknown[] | undefined) ?? [];
        arr.push(currentObj);
        meta[currentKey] = arr;
        currentObj = null;
      }

      const itemContent = trimmed.slice(4);
      const colonIdx = itemContent.indexOf(":");
      if (colonIdx !== -1) {
        const itemKey = itemContent.slice(0, colonIdx).trim();
        const itemValue = itemContent.slice(colonIdx + 1).trim();
        // Peek ahead: if next line is indented deeper (4+ spaces), this is an object item
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        if (nextLine.match(/^ {4}\S/)) {
          // Start a new object list item
          currentObj = { [itemKey]: castPrimitive(itemValue) };
        } else {
          // Single key:value — could still be a standalone object entry or just "  - key: value"
          // Treat as a flat string to preserve backwards compatibility
          const arr = (meta[currentKey] as unknown[] | undefined) ?? [];
          arr.push(itemContent);
          meta[currentKey] = arr;
        }
      } else {
        // Plain string list item (no colon)
        const arr = (meta[currentKey] as unknown[] | undefined) ?? [];
        arr.push(itemContent);
        meta[currentKey] = arr;
      }
    } else if (trimmed.match(/^ {4}\S/) && currentObj && currentKey) {
      // Continuation line for the current object (4-space indent)
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx !== -1) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        currentObj[key] = castPrimitive(value);
      }
    } else if (trimmed.includes(":")) {
      // Flush any pending object before starting a new top-level key
      if (currentObj && currentKey) {
        const arr = (meta[currentKey] as unknown[] | undefined) ?? [];
        arr.push(currentObj);
        meta[currentKey] = arr;
        currentObj = null;
      }
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      currentKey = key;
      if (value) meta[key] = value;
    }
  }

  // Flush final pending object
  if (currentObj && currentKey) {
    const arr = (meta[currentKey] as unknown[] | undefined) ?? [];
    arr.push(currentObj);
    meta[currentKey] = arr;
  }

  return { meta, body };
}

/** Cast common YAML primitives (booleans, numbers) from string values. */
export function castPrimitive(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !isNaN(Number(value))) return Number(value);
  return value;
}
