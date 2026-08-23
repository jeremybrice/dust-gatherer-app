import { drizzle } from "drizzle-orm/netlify-db";

// Module-scope DB client: constructed once, lazily, and reused across
// invocations — never per request, which exhausts the connection limit.
//
// Lazy rather than eager so importing this module never throws when the
// database is unconfigured (unit tests, plain `next dev`, and the production
// build itself, which runs without NETLIFY_DB_URL). Callers gate on
// isDbConfigured() and surface a "not configured" state instead.
//
// Called with NO arguments deliberately. The adapter reads NETLIFY_DB_URL
// itself, and only its zero-argument branch honours NETLIFY_DB_DRIVER — passing
// an explicit `connection` skips that check and pins the client to the Neon
// HTTP driver with no way to switch. Setting NETLIFY_DB_DRIVER=server selects
// node-postgres over TCP instead, which is the working configuration in
// production: the deployed Neon HTTP client is invoked without its `.query`
// method present, so drizzle falls back to calling it as a plain function and
// the Neon client rejects that as a non-tagged-template call.
//
// drizzle-orm 1.0 also dropped the `schema` option (DrizzlePgConfig is
// Omit<DrizzleConfig, "schema">) — it belonged to the old relational-query API.
// Queries here use db.select()/insert()/update(), which take table references
// directly, so nothing is lost.
const makeDb = () => drizzle();
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
