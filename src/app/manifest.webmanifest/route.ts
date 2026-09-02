import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { webManifest } from "@/lib/webManifest";

// Served from a route so theme_color can follow this device's dg-theme
// cookie. The static file was Classic burgundy and froze the installed
// PWA chrome on every palette.
export async function GET() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return new Response(JSON.stringify(webManifest(theme)), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache",
    },
  });
}
