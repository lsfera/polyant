// SPDX-License-Identifier: AGPL-3.0-or-later

import { Controller, Get, Patch, Param, Body, BadRequestException } from "@nestjs/common";
import { getEnabledToolNames } from "../../instances/instance-tools.store.js";
import { listAvailableTools, type RequiredSecretSpec } from "../../agents/tools/registry.js";
import { findInstanceOrFail } from "./instance-helpers.js";
import { getAllSecretsById } from "../../instances/secrets.store.js";
import { db } from "../../database/client.js";
import { instanceTools } from "../../instances/instance-tools.schema.js";
import { tools } from "../../agents/tools/tools.schema.js";
import { eq, and, inArray } from "drizzle-orm";

/** Spec returned to the admin UI: includes `currentValue` for non-sensitive `select` fields. */
type RequiredSecretSpecWithValue = RequiredSecretSpec & { currentValue?: string };

@Controller("api/instances")
export class InstanceToolsController {
  @Get(":slug/tools/required-secrets")
  async getRequiredSecrets(@Param("slug") slug: string) {
    const instance = await findInstanceOrFail(slug);
    const enabledNames = await getEnabledToolNames(instance.id);
    const allTools = listAvailableTools();

    // De-duplicate specs by key (first-seen wins). The UI needs the rich form
    // (type, choices, label, description) so it can render <Select> vs <Input>.
    const specsByKey = new Map<string, RequiredSecretSpec>();
    for (const t of allTools) {
      const isEnabled = enabledNames.size === 0 || enabledNames.has(t.name);
      if (isEnabled && t.requiredSecrets) {
        for (const spec of t.requiredSecrets) {
          if (!specsByKey.has(spec.key)) {
            specsByKey.set(spec.key, spec);
          }
        }
      }
    }

    // For `select` fields, surface the current value in cleartext — it's a non-sensitive
    // choice (e.g. "tavily"), not a secret. `text` fields (true API keys) stay hidden.
    const hasSelect = Array.from(specsByKey.values()).some((s) => s.type === "select");
    const currentSecrets = hasSelect ? await getAllSecretsById(instance.id) : {};

    const requiredSecrets: RequiredSecretSpecWithValue[] = Array.from(specsByKey.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((spec) => {
        if (spec.type === "select") {
          const currentValue = currentSecrets[spec.key];
          return currentValue ? { ...spec, currentValue } : { ...spec };
        }
        return { ...spec };
      });

    return { requiredSecrets };
  }

  @Get(":slug/tools")
  async getTools(@Param("slug") slug: string) {
    const instance = await findInstanceOrFail(slug);

    // Query instance_tools with source info
    const enabledRows = await db
      .select({ name: tools.name, source: instanceTools.source })
      .from(instanceTools)
      .innerJoin(tools, eq(instanceTools.toolId, tools.id))
      .where(eq(instanceTools.instanceId, instance.id));

    const enabledMap = new Map(enabledRows.map((r) => [r.name, r.source]));
    const allTools = listAvailableTools();
    const result = allTools.map((t) => ({
      ...t,
      enabled: enabledMap.has(t.name),
      source: enabledMap.get(t.name) ?? null,
    }));
    return { tools: result };
  }

  @Patch(":slug/tools")
  async updateTools(
    @Param("slug") slug: string,
    @Body() body: { enabled: string[] },
  ) {
    const instance = await findInstanceOrFail(slug);
    const enabledSet = new Set(body.enabled);

    // Get current instance tools with source info
    const currentRows = await db
      .select({ toolId: instanceTools.toolId, name: tools.name, source: instanceTools.source })
      .from(instanceTools)
      .innerJoin(tools, eq(instanceTools.toolId, tools.id))
      .where(eq(instanceTools.instanceId, instance.id));

    const currentByName = new Map(currentRows.map((r) => [r.name, r]));

    // Tools to add as manual (requested but not currently enabled)
    const toAdd: string[] = [];
    for (const name of enabledSet) {
      if (!currentByName.has(name)) {
        toAdd.push(name);
      }
    }

    // Tools to remove (currently manual but not in requested set)
    const toRemove: string[] = [];
    for (const row of currentRows) {
      if (row.source === "manual" && !enabledSet.has(row.name)) {
        toRemove.push(row.toolId);
      }
      // Cannot disable global or skill-sourced tools
      if ((row.source === "global" || row.source === "skill") && !enabledSet.has(row.name)) {
        throw new BadRequestException(
          `Cannot disable ${row.source}-sourced tool "${row.name}". It is required by the system or an active skill.`,
        );
      }
    }

    // Insert new manual tools
    if (toAdd.length > 0) {
      const toolRows = await db
        .select({ id: tools.id })
        .from(tools)
        .where(inArray(tools.name, toAdd));

      if (toolRows.length > 0) {
        await db
          .insert(instanceTools)
          .values(toolRows.map((t) => ({ instanceId: instance.id, toolId: t.id, source: "manual" as const })))
          .onConflictDoNothing();
      }
    }

    // Remove manual tools that were disabled
    if (toRemove.length > 0) {
      await db
        .delete(instanceTools)
        .where(
          and(
            eq(instanceTools.instanceId, instance.id),
            inArray(instanceTools.toolId, toRemove),
          ),
        );
    }

    // Return updated tool list with source
    const updatedRows = await db
      .select({ name: tools.name, source: instanceTools.source })
      .from(instanceTools)
      .innerJoin(tools, eq(instanceTools.toolId, tools.id))
      .where(eq(instanceTools.instanceId, instance.id));

    const updatedMap = new Map(updatedRows.map((r) => [r.name, r.source]));
    const allTools = listAvailableTools();
    const resultTools = allTools.map((t) => ({
      ...t,
      enabled: updatedMap.has(t.name),
      source: updatedMap.get(t.name) ?? null,
    }));
    return { tools: resultTools };
  }
}
