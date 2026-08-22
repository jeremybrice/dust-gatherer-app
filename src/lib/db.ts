import { drizzle } from "drizzle-orm/netlify-db";

// Module-scope DB client: constructed once, lazily, and reused across
// invocations — never per request, which exhausts the connection limit.
//
// Lazy rather than eager so importing this module never throws when the
// database is unconfigured (unit tests, plain `next dev`, and the production
// build itself, which runs without NETLIFY_DB_URL). Callers gate on
// isDbConfigured() and surface a "not configured" state instead.
// drizzle-orm 1.0 dropped the `schema` option (DrizzlePgConfig is
// Omit<DrizzleConfig, "schema">) — it belonged to the old relational-query API.
// Queries here are built with db.select()/insert()/update(), which take their
// table references directly, so nothing is lost. The connection is passed
// explicitly because the adapter's overloads require it.
const makeDb = () => {
  const connection = process.env.NETLIFY_DB_URL;
  if (!connection) throw new Error("NETLIFY_DB_URL is not configured");
  return drizzle({ connection });
};
type Db = ReturnType<typeof makeDb>;
let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) _db = makeDb();
  return _db;
}

/** Readiness flag for backend selection. Guarded so an unconfigured
 *  environment yields false rather than throwing at import time. */
export function isDbConfigured(): boolean {
  try {
    return process.env.NETLIFY_DB_URL != null && process.env.NETLIFY_DB_URL.length > 0;
  } catch {
    return false;
  }
}
