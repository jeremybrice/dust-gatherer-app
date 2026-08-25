import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));

function readPublic(rel: string): string {
  return readFileSync(path.join(root, "public", rel), "utf8");
}

describe("manifest.webmanifest", () => {
  it("meets Chromium install criteria", () => {
    const manifest = JSON.parse(readPublic("manifest.webmanifest")) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(manifest.name).toBe("Dust Gatherer");
    expect(manifest.short_name).toBe("Dust Gatherer");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#722F37");
    expect(manifest.background_color).toBe("#FAF7F2");
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
