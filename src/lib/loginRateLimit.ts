import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { loginAttempts } from "@/lib/schema";

// Brute-force protection for the single shared passphrase. One credential on a
// public URL is guessable given enough attempts, so failures are counted per
// client IP and the account locks out temporarily once they pile up.
//
// product-almanac solves the equivalent problem with Upstash Redis; counting in
// Postgres avoids adding a second vendor for one user's login.

const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

/** Salted hash of the client IP. The address itself is never stored, and the
 *  submitted passphrase never reaches this module. */
async function hashIp(ip: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Best-effort client address. Netlify sets x-nf-client-connection-ip; the
 *  x-forwarded-for fallback takes the first hop, which is the client. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export interface RateLimitState {
  locked: boolean;
  retryAfterSeconds: number;
}

/**
 * Whether this client is currently locked out.
 *
 * Fails OPEN when the database is unavailable: a database outage must not lock
 * the only user out of their own app. The passphrase check itself is unaffected,
 * so an outage costs rate limiting, not authentication.
 */
export async function checkRateLimit(ip: string, secret: string): Promise<RateLimitState> {
  if (!isDbConfigured()) return { locked: false, retryAfterSeconds: 0 };
  try {
    const ipHash = await hashIp(ip, secret);
    const rows = await getDb()
      .select()
      .from(loginAttempts)
      .where(sql`${loginAttempts.ipHash} = ${ipHash}`);
    const row = rows[0];
    if (!row || row.failures < MAX_FAILURES) return { locked: false, retryAfterSeconds: 0 };

    const elapsed = (Date.now() - row.lastFailureAt.getTime()) / 1000;
    const remaining = WINDOW_MINUTES * 60 - elapsed;
    if (remaining <= 0) return { locked: false, retryAfterSeconds: 0 };
    return { locked: true, retryAfterSeconds: Math.ceil(remaining) };
  } catch {
    return { locked: false, retryAfterSeconds: 0 };
  }
}

/** Record a failed attempt. Counting restarts once the window has lapsed, so a
 *  stale failure from hours ago cannot combine with a fresh one to lock out. */
export async function recordFailure(ip: string, secret: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const ipHash = await hashIp(ip, secret);
    await getDb()
      .insert(loginAttempts)
      .values({ ipHash, failures: 1, lastFailureAt: new Date() })
      .onConflictDoUpdate({
        target: loginAttempts.ipHash,
        set: {
          failures: sql`case
            when ${loginAttempts.lastFailureAt} < now() - interval '${sql.raw(String(WINDOW_MINUTES))} minutes'
            then 1
            else ${loginAttempts.failures} + 1
          end`,
          lastFailureAt: sql`now()`,
        },
      });
  } catch {
    // Rate limiting is best-effort; never block a login attempt on it.
  }
}

/** Clear the counter after a successful sign-in. */
export async function clearFailures(ip: string, secret: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const ipHash = await hashIp(ip, secret);
    await getDb().delete(loginAttempts).where(sql`${loginAttempts.ipHash} = ${ipHash}`);
  } catch {
    // best-effort
  }
}
