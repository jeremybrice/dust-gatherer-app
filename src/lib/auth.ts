import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** True when the caller presents a valid session cookie. */
export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  const claims = await verifySession(
    store.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );
  return claims !== null;
}

/**
 * Page-boundary gate. Middleware already redirects unauthenticated browser
 * navigation, but pages re-check independently so a misconfigured matcher can
 * never expose data — the gate lives at the boundary that reads it.
 */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) redirect("/login");
}

/** Route-handler gate: returns a ready 401 when not signed in, else null. */
export async function gateApi(): Promise<NextResponse | null> {
  if (await isSignedIn()) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
