import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

export const dbKind: "neon" | "pglite" = process.env.DATABASE_URL
  ? "neon"
  : "pglite";

const globalForDb = globalThis as unknown as { __bazaarDb?: Db };

export const db: Db =
  globalForDb.__bazaarDb ??
  (globalForDb.__bazaarDb = process.env.DATABASE_URL
    ? (drizzleNeon(neon(process.env.DATABASE_URL), { schema }) as unknown as Db)
    : drizzlePglite(
        new PGlite(process.env.PGLITE_DATA_DIR ?? ".data/pglite"),
        { schema }
      ));
