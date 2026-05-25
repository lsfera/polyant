// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { renderTemplateBody, type TemplateDefinition } from "./render-template.js";

describe("renderTemplateBody", () => {
  it("substitutes {{N}} placeholders with the matching variable", () => {
    const template: TemplateDefinition = {
      body: "Hi {{1}}, see you on {{2}}.",
    };
    const out = renderTemplateBody(template, { "1": "Jane", "2": "May 26" });
    expect(out).toBe("Hi Jane, see you on May 26.");
  });

  it("leaves unresolved placeholders as {{N}} for debug visibility", () => {
    const template: TemplateDefinition = {
      body: "Hi {{1}}, {{2}} is optional.",
    };
    const out = renderTemplateBody(template, { "1": "Jane" });
    expect(out).toBe("Hi Jane, {{2}} is optional.");
  });

  it("appends action labels in '[Button: ...]' style", () => {
    const template: TemplateDefinition = {
      body: "Please confirm {{1}}",
      actions: [{ label: "Yes" }, { label: "No thanks {{1}}" }],
    };
    const out = renderTemplateBody(template, { "1": "Jane" });
    expect(out).toBe(
      "Please confirm Jane\n\n[Button: Yes]\n[Button: No thanks Jane]",
    );
  });

  it("returns just the body when actions are absent or empty", () => {
    const template: TemplateDefinition = {
      body: "Plain {{1}}",
      actions: [],
    };
    const out = renderTemplateBody(template, { "1": "X" });
    expect(out).toBe("Plain X");
  });
});
