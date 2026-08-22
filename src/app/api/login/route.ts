import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { checkRateLimit, clearFailures, clientIp, recordFailure } from "@/lib/loginRateLimit";

// Node runtime (not edge) so node:crypto's timingSafeEqual is available for the
// passphrase comparison. The session module this imports stays Web-Crypto-only
// because middleware also imports it.
export const runtime = "nodejs";

/** Constant-time comparison that does not leak length through an early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still burn a comparison so a wrong-length guess is not measurably faster.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const expected = process.env.DUST_GATHERER_PASSPHRASE ?? "";
  const secret = process.env.SESSION_SECRET ?? "";

  // Fail closed on missing configuration rather than admitting everyone with a
  // blank passphrase.
  if (!expected || !secret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let passphrase = "";
  try {
    const body = await req.json();
    passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const limit = await checkRateLimit(ip, secret);
  if (limit.locked) {
    return NextResponse.json(
      { error: "too many attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!passphrase || !safeEqual(passphrase, expected)) {
    await recordFailure(ip, secret);
    // One generic message: never reveal whether the passphrase was blank,
    // close, or wrong.
    return NextResponse.json({ error: "invalid passphrase" }, { status: 401 });
  }

  await clearFailures(ip, secret);
  const token = await issueSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(new URL(req.url).protocol === "https:"),
  );
  return res;
}
