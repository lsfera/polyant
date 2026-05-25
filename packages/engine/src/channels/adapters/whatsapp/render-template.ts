// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Render a Twilio Content template body for conversation history.
 *
 * Twilio approves WhatsApp templates as `Content` resources. The Content API
 * (`GET https://content.twilio.com/v1/Content/{ContentSid}`) returns a
 * structured definition keyed by `types` (e.g. `twilio/text`,
 * `twilio/quick-reply`, `twilio/call-to-action`, `twilio/card`). The user on
 * WhatsApp sees the body of the chosen type with `{{N}}` placeholders
 * substituted by the `contentVariables` payload.
 *
 * For conversation history we want the same plain-text rendering — so the
 * agent (and operators reading the admin panel) can read what was actually
 * sent. Buttons / quick-reply / CTA actions are appended in a compact
 * `[Button: <label>]` style consistent with the legacy `stub-templates.ts`
 * catalog.
 */

export type TemplateDefinition = {
  /** Main body of the template with `{{N}}` placeholders. */
  body: string;
  /** Optional buttons / quick-reply / CTA labels (also support `{{N}}`). */
  actions?: { label: string }[];
};

/**
 * Substitute `{{N}}` placeholders with `variables[N]`. Unresolved placeholders
 * are kept as `{{N}}` for debug visibility. Action labels (when present) are
 * appended to the body as `[Button: <label>]` lines, with the same
 * placeholder substitution applied.
 */
export function renderTemplateBody(
  template: TemplateDefinition,
  variables: Record<string, string>,
): string {
  const sub = (input: string): string =>
    input.replace(/\{\{(\d+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);

  const renderedBody = sub(template.body);
  if (!template.actions || template.actions.length === 0) return renderedBody;

  const renderedActions = template.actions
    .map((a) => `[Button: ${sub(a.label)}]`)
    .join("\n");
  return `${renderedBody}\n\n${renderedActions}`;
}
