import { db } from "../src/database/client.js";
import { queryClient } from "../src/database/client.js";
import { instances } from "../src/instances/schema.js";
import { recomputeInstanceTools } from "../src/instances/instance-tools.store.js";

async function main() {
  const rows = await db.select({ id: instances.id, slug: instances.slug }).from(instances);
  for (const inst of rows) {
    await recomputeInstanceTools(inst.id);
    console.log(`Recomputed tools for ${inst.slug}`);
  }
  await queryClient.end();
}

main().catch(console.error);
