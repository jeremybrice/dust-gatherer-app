import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
