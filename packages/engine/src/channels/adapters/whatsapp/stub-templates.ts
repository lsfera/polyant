// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Local catalog of WhatsApp template bodies — used for history reconstruction.
 *
 * When `send_whatsapp_template` tool is called with a contentSid matching an
 * entry here, the rendered body is persisted into conversation history so the
 * agent "remembers" what was sent. If no entry matches, a compact summary with
 * the variables is stored instead.
 *
 * In production this catalog should mirror the Twilio-approved Content
 * templates (whose real contentSids look like `HX[A-Za-z0-9]+`). This file is
 * intentionally empty in the open-source distribution — populate it to match
 * your own approved templates, or leave it empty and rely on the compact
 * summary fallback.
 *
 * Example entry:
 *   "HXabc123": "Hi {{1}}, your appointment is on {{2}}."
 */

export const STUB_TEMPLATES: Record<string, string> = {};

/**
 * Render a local template: substitute `{{N}}` placeholders with the matching
 * entry in `variables`. Unresolved placeholders are left as-is. Returns null
 * if no local template matches the given id.
 */
export function renderStubTemplate(
  templateId: string,
  variables: Record<string, string>,
): string | null {
  const body = STUB_TEMPLATES[templateId];
  if (!body) return null;
  return body.replace(/\{\{(\d+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}
