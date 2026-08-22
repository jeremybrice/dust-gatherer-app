import { SignJWT, jwtVerify } from "jose";

// Session cookie for the single-user passphrase login.
//
// EDGE-SAFE BY CONSTRUCTION: this module is imported by middleware, which
// Netlify runs on the edge runtime, so it must use Web Crypto only. `jose`
// is built on Web Crypto; importing `node:crypto` here would break the build.
// The passphrase comparison itself lives in the /api/login route handler,
// which runs on Node and may use node:crypto freely.

export const SESSION_COOKIE = "dg_session";

// 90 days. An installed web app that demands the passphrase weekly is unusable
// in the field; rotating SESSION_SECRET is the revocation mechanism instead.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// Refresh the cookie once it is over a third of the way through its life, so
// an actively used install never expires, without a Set-Cookie on every request.
const REFRESH_AFTER_SECONDS = SESSION_MAX_AGE_SECONDS / 3;

const SUBJECT = "dust-gatherer-user";

export const sessionCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Mint a signed session token. Throws if the secret is empty — a blank secret
 *  would sign tokens anyone could forge. */
export async function issueSession(secret: string, now = new Date()): Promise<string> {
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(SUBJECT)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey(secret));
}

export interface SessionClaims {
  issuedAt: number;
  expiresAt: number;
}

/**
 * Verify a session token against the current secret.
 *
 * Fails closed on every error path — missing token, empty secret, wrong
 * signature, expired, or a token minted for a different subject — so a rotated
 * SESSION_SECRET invalidates every outstanding session.
 */
export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<SessionClaims | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ["HS256"],
      subject: SUBJECT,
    });
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return { issuedAt: payload.iat, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

/** True once the token is old enough to be worth re-issuing. */
export function shouldRefresh(claims: SessionClaims, now = new Date()): boolean {
  return Math.floor(now.getTime() / 1000) - claims.issuedAt > REFRESH_AFTER_SECONDS;
}
