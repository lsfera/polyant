import { db } from "../src/database/client.js";
import { queryClient } from "../src/database/client.js";
import { instanceSkills } from "../src/instances/instance-skills.schema.js";
import { skills } from "../src/skills/schema.js";
import { instances } from "../src/instances/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ instance: instances.slug, skill: skills.slug, enabled: instanceSkills.enabled })
    .from(instanceSkills)
    .innerJoin(skills, eq(instanceSkills.skillId, skills.id))
    .innerJoin(instances, eq(instanceSkills.instanceId, instances.id));

  console.log("\n=== instance_skills ===");
  console.table(rows);

  const allSkills = await db.select({ slug: skills.slug, status: skills.status }).from(skills);
  console.log("\n=== skills (library) ===");
  console.table(allSkills);

  await queryClient.end();
}

main().catch(console.error);
