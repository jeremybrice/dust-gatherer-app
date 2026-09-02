import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPublicPath } from "@/middleware";
import { DEFAULT_THEME } from "@/lib/theme";
import { webManifest } from "@/lib/webManifest";

const root = fileURLToPath(new URL("../..", import.meta.url));

function readPublic(rel: string): string {
  return readFileSync(path.join(root, "public", rel), "utf8");
}

describe("manifest.webmanifest", () => {
  it("meets Chromium install criteria and paints chrome with the page background", () => {
    const manifest = webManifest(DEFAULT_THEME);
    expect(manifest.name).toBe("Dust Gatherer");
    expect(manifest.short_name).toBe("Dust Gatherer");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe(DEFAULT_THEME.bg);
    expect(manifest.theme_color).not.toBe(DEFAULT_THEME.accent);
    expect(manifest.background_color).toBe(DEFAULT_THEME.bg);
    // Two 512 icons share sizes; Object.fromEntries would keep the maskable last.
    const bySize = Object.fromEntries(
      manifest.icons.filter((i) => i.purpose !== "maskable").map((i) => [i.sizes, i]),
    );
    expect(bySize["192x192"]?.src).toBe("/icons/icon-192.png");
    expect(bySize["512x512"]?.src).toBe("/icons/icon-512.png");
    const maskable = manifest.icons.find((i) => i.purpose === "maskable");
    expect(maskable?.src).toBe("/icons/icon-512-maskable.png");
    expect(maskable?.sizes).toBe("512x512");
  });

  it("uses the dark page background when Dark is pinned", () => {
    const theme = { ...DEFAULT_THEME, mode: "dark" as const, bgDark: "#12181C" };
    expect(webManifest(theme).theme_color).toBe("#12181C");
  });

  it("has the committed icon files", () => {
    for (const rel of [
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-512-maskable.png",
      "icons/apple-touch-icon.png",
    ]) {
      expect(existsSync(path.join(root, "public", rel)), rel).toBe(true);
    }
  });
});

describe("service worker", () => {
  it("has a fetch handler and never cache.puts /api/", () => {
    const sw = readPublic("sw.js");
    expect(sw).toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);
    // A precached manifest would freeze the install-time burgundy chrome.
    expect(sw).not.toMatch(/\/manifest\.webmanifest/);
    const puts = [...sw.matchAll(/cache\.put\s*\(([^)]*)\)/g)].map((m) => m[1]);
    for (const args of puts) {
      expect(args.includes("/api/")).toBe(false);
    }
    expect(sw).not.toMatch(/pathname\.startsWith\(\s*["']\/api\/["']\s*\)[\s\S]{0,200}cache\.put/);
  });
});

describe("isPublicPath", () => {
  it("keeps PWA assets off the auth redirect", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/offline")).toBe(true);
    expect(isPublicPath("/icons/icon-192.png")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/inventory")).toBe(false);
    expect(isPublicPath("/api/items")).toBe(false);
  });
});
