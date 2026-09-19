import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

export const dbKind: "neon" | "pglite" = process.env.DATABASE_URL
  ? "neon"
  : "pglite";

const g = globalThis as unknown as {
  __bazaarDb?: Db;
  __bazaarSignalsRegistered?: boolean;
};

function createDb(): Db {
  if (process.env.DATABASE_URL) {
    return drizzleNeon(neon(process.env.DATABASE_URL), {
      schema,
    }) as unknown as Db;
  }
  const pg = new PGlite(process.env.PGLITE_DATA_DIR ?? ".data/pglite");
  if (!g.__bazaarSignalsRegistered) {
    g.__bazaarSignalsRegistered = true;
    const shutdown = async () => {
      try {
        await pg.close();
      } finally {
        process.exit(0);
      }
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
  return drizzlePglite(pg, { schema });
}

function getDb(): Db {
  return (g.__bazaarDb ??= createDb());
}

// Lazy: PGlite is instantiated on first query, not at module load. Next dev
// loads route modules in worker processes (e.g. static-paths-worker) that must
// never open the data dir — only a process that actually queries does.
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = getDb();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
