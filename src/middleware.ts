import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  issueSession,
  sessionCookieOptions,
  shouldRefresh,
  verifySession,
} from "@/lib/session";

// Runs on Netlify's EDGE runtime. Everything it imports must be Web Crypto only
// — see the note in session.ts.

// Public paths. The PWA assets MUST stay public: a redirected /sw.js fails
// service-worker registration, which silently makes the app non-installable.
const PUBLIC = [
  /^\/login$/,
  /^\/api\/login$/,
  /^\/api\/logout$/,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
  /^\/offline$/,
  /^\/icons\//,
];

const isPublic = (path: string) => PUBLIC.some((re) => re.test(path));

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const secret = process.env.SESSION_SECRET ?? "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token, secret);

  const res = ((): NextResponse => {
    if (isPublic(pathname)) return NextResponse.next();
    if (!claims) {
      // API callers get a 401; a redirect to an HTML login page would be
      // unparseable to fetch() and mask the real cause.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(pathname + search)}`, req.url),
      );
    }
    return NextResponse.next();
  })();

  // Slide the expiry on an actively used session so an installed app never
  // logs itself out mid-use.
  if (claims && shouldRefresh(claims)) {
    const refreshed = await issueSession(secret);
    res.cookies.set(
      SESSION_COOKIE,
      refreshed,
      sessionCookieOptions(req.nextUrl.protocol === "https:"),
    );
  }

  // Security headers live here, NOT in netlify.toml — Netlify applies config
  // headers after middleware, so headers declared there would mask these.
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
};
