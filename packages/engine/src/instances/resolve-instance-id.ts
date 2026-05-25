// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { instances } from "./schema.js";

/** Resolve an instance slug to its UUID. */
export async function resolveInstanceId(slug: string): Promise<string | undefined> {
  const rows = await db
    .select({ id: instances.id })
    .from(instances)
    .where(eq(instances.slug, slug))
    .limit(1);
  return rows[0]?.id;
}

/** Resolve an instance UUID to its slug. */
export async function resolveInstanceSlug(instanceId: string): Promise<string | undefined> {
  const rows = await db
    .select({ slug: instances.slug })
    .from(instances)
    .where(eq(instances.id, instanceId))
    .limit(1);
  return rows[0]?.slug;
}
