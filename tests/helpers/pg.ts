import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ImportDb } from "@/lib/importItems";

const MIGRATIONS_DIR = "netlify/database/migrations";

/**
 * An in-process Postgres with the committed migrations applied.
 *
 * This runs the ACTUAL generated SQL rather than a hand-written approximation,
 * so a schema change that drizzle-kit emits differently is caught here rather
 * than on deploy.
 */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((d) => !d.startsWith("."))
    .sort();
  for (const m of migrations) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m, "migration.sql"), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) await db.exec(stmt);
    }
  }
  return db;
}

/** A drizzle instance over a migrated in-process Postgres, so tests exercise
 *  the same query code that runs in production. */
export async function freshDrizzle(): Promise<{ db: ImportDb; client: PGlite }> {
  const client = await freshDb();
  return { db: drizzle({ client }) as unknown as ImportDb, client };
}
