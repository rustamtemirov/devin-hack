import { dbKind } from "./client";
import { seed } from "./seed-lib";
import { SEED_AGENTS } from "./seed-data";

seed()
  .then(() => {
    console.log(`Seeded ${SEED_AGENTS.length} agents (db: ${dbKind})`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
