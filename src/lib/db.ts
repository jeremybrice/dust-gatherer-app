import { drizzle } from "drizzle-orm/node-postgres";

// Module-scope DB client: constructed once, lazily, and reused across
// invocations — never per request, which exhausts the connection limit.
//
// Lazy rather than eager so importing this module never throws when the
// database is unconfigured (unit tests, plain `next dev`, and the production
// build itself, which runs without NETLIFY_DB_URL). Callers gate on
// isDbConfigured() and surface a "not configured" state instead.
//
// WHY node-postgres RATHER THAN drizzle-orm/netlify-db
//
// The netlify-db adapter defaults to Neon's HTTP client. In the deployed
// Netlify runtime that client arrives without its `.query` method, so the
// adapter's `httpClient.query ?? httpClient` fallback invokes it as a plain
// function and Neon rejects the call:
//
//   "This function can now be called only as a tagged-template function"
//
// The adapter's own escape hatch, NETLIFY_DB_DRIVER=server, resolves this by
// delegating to `drizzle({ connection })` from drizzle-orm/node-postgres —
// exactly what this module now calls directly. Selecting the driver here
// rather than through an environment variable means the app cannot be
// deployed into the broken configuration by omitting a setting, and the
// choice is visible in the code that depends on it.
//
// Note that drizzle-orm 1.0 dropped the `schema` option (DrizzlePgConfig is
// Omit<DrizzleConfig, "schema">) — it belonged to the old relational-query
// API. Queries here use db.select()/insert()/update(), which take table
// references directly, so nothing is lost.
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
