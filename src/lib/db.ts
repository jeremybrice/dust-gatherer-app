import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "@/lib/schema";

// Module-scope DB client: constructed once, lazily, and reused across
// invocations — never per request, which exhausts the connection limit.
//
// Lazy rather than eager so importing this module never throws when the
// database is unconfigured (unit tests, plain `next dev`, and the production
// build itself, which runs without NETLIFY_DB_URL). Callers gate on
// isDbConfigured() and surface a "not configured" state instead.
const makeDb = () => drizzle({ schema });
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
