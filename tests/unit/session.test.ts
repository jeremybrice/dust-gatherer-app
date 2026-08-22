import { describe, it, expect } from "vitest";
import {
  issueSession, verifySession, shouldRefresh, SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

const SECRET = "test-secret-value";

describe("session", () => {
  it("round-trips a token it issued", async () => {
    const claims = await verifySession(await issueSession(SECRET), SECRET);
    expect(claims).not.toBeNull();
    expect(claims!.expiresAt - claims!.issuedAt).toBe(SESSION_MAX_AGE_SECONDS);
  });

  // Rotating SESSION_SECRET is the revocation mechanism, so this must hold.
  it("rejects a token signed with a different secret", async () => {
    const token = await issueSession(SECRET);
    expect(await verifySession(token, "rotated-secret")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await issueSession(SECRET);
    const [h, p, s] = token.split(".");
    expect(await verifySession(`${h}.${p}x.${s}`, SECRET)).toBeNull();
  });

  it("rejects missing input and refuses to verify against a blank secret", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
    expect(await verifySession(await issueSession(SECRET), "")).toBeNull();
  });

  it("refuses to issue against a blank secret", async () => {
    await expect(issueSession("")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("rejects an expired token", async () => {
    const past = new Date(Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000);
    expect(await verifySession(await issueSession(SECRET, past), SECRET)).toBeNull();
  });

  it("refreshes only once well into the token's life", async () => {
    const now = new Date();
    const iat = Math.floor(now.getTime() / 1000);
    expect(shouldRefresh({ issuedAt: iat, expiresAt: 0 }, now)).toBe(false);
    const old = iat - (SESSION_MAX_AGE_SECONDS / 2);
    expect(shouldRefresh({ issuedAt: old, expiresAt: 0 }, now)).toBe(true);
  });
});
