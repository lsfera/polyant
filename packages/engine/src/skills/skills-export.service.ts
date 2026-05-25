// SPDX-License-Identifier: AGPL-3.0-or-later

// ---------------------------------------------------------------------------
// Skills catalog export/import
// ---------------------------------------------------------------------------

import { eq, inArray } from "drizzle-orm";
import { db } from "../database/client.js";
import { skills, skillVersions } from "./schema.js";
import {
  skillsCatalogBundleSchema,
  type SkillsCatalogBundle,
} from "../instances/export.schema.js";
import { createSkill, updateSkill, listVersions } from "./skills.store.js";

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSkillsCatalog(): Promise<SkillsCatalogBundle> {
  const allSkills = await db
    .select()
    .from(skills)
    .where(eq(skills.status, "active"))
    .orderBy(skills.slug);

  const skillIds = allSkills.map((s) => s.id);

  // Batch-fetch all versions
  const allVersions = skillIds.length > 0
    ? await db
        .select()
        .from(skillVersions)
        .where(inArray(skillVersions.skillId, skillIds))
        .orderBy(skillVersions.createdAt)
    : [];

  const versionsBySkill = new Map<string, typeof allVersions>();
  for (const v of allVersions) {
    const list = versionsBySkill.get(v.skillId) ?? [];
    list.push(v);
    versionsBySkill.set(v.skillId, list);
  }

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    type: "skills",
    skills: allSkills.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      category: s.category,
      isDefault: s.isDefault,
      versions: (versionsBySkill.get(s.id) ?? []).map((v) => ({
        version: v.version,
        content: v.content,
        metadata: (v.metadata ?? {}) as Record<string, unknown>,
        scripts: (v.scripts ?? []) as { file: string; description: string; content: string }[],
        changelog: v.changelog ?? null,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Export single skill
// ---------------------------------------------------------------------------

export async function exportSingleSkill(slug: string): Promise<SkillsCatalogBundle> {
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1);

  if (!skill) throw new Error(`Skill "${slug}" not found`);

  const versions = await db
    .select()
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(skillVersions.createdAt);

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    type: "skills",
    skills: [{
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      isDefault: skill.isDefault,
      versions: versions.map((v) => ({
        version: v.version,
        content: v.content,
        metadata: (v.metadata ?? {}) as Record<string, unknown>,
        scripts: (v.scripts ?? []) as { file: string; description: string; content: string }[],
        changelog: v.changelog ?? null,
      })),
    }],
  };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface SkillsImportResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

export async function importSkillsCatalog(rawBundle: unknown): Promise<SkillsImportResult> {
  const bundle = skillsCatalogBundleSchema.parse(rawBundle);
  const result: SkillsImportResult = { created: [], updated: [], skipped: [] };

  for (const entry of bundle.skills) {
    if (entry.versions.length === 0) {
      result.skipped.push(entry.slug);
      continue;
    }

    // Check if skill already exists
    const [existing] = await db
      .select({ id: skills.id })
      .from(skills)
      .where(eq(skills.slug, entry.slug))
      .limit(1);

    // Use the latest version from the bundle
    const latestVersion = entry.versions[entry.versions.length - 1];

    if (!existing) {
      // Create new skill with the latest version
      await createSkill({
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        content: latestVersion.content,
        metadata: latestVersion.metadata,
        scripts: latestVersion.scripts,
        isDefault: entry.isDefault,
      });
      result.created.push(entry.slug);
    } else {
      // Update existing skill — creates a new version
      const existingVersions = await listVersions(existing.id);
      const existingVersionStrings = new Set(existingVersions.map((v) => v.version));

      // Only update if the latest version from bundle is not already present
      if (!existingVersionStrings.has(latestVersion.version)) {
        await updateSkill(entry.slug, {
          name: entry.name,
          description: entry.description,
          category: entry.category,
          content: latestVersion.content,
          metadata: latestVersion.metadata,
          scripts: latestVersion.scripts,
          changelog: latestVersion.changelog ?? `Imported from bundle`,
        });
        result.updated.push(entry.slug);
      } else {
        result.skipped.push(entry.slug);
      }
    }
  }

  return result;
}
