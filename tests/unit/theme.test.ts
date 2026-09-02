import { describe, it, expect } from "vitest";
import {
  COLOR_KEYS,
  DEFAULT_THEME,
  PRESETS,
  THEME_COOKIE,
  contrastText,
  cssVars,
  isDefaultTheme,
  parseTheme,
  serializeTheme,
  themeCookieString,
} from "@/lib/theme";

const HEX = /^#[0-9A-F]{6}$/;

describe("parseTheme", () => {
  it("returns the default theme for a missing or garbage cookie", () => {
    expect(parseTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme("")).toEqual(DEFAULT_THEME);
    expect(parseTheme("not a theme")).toEqual(DEFAULT_THEME);
    expect(parseTheme('{"accent":"#123456"}')).toEqual(DEFAULT_THEME);
  });

  it("round-trips every preset unchanged", () => {
    for (const preset of PRESETS) {
      const theme = { ...preset.colors, mode: "system" as const };
      expect(parseTheme(serializeTheme(theme)), preset.id).toEqual(theme);
    }
  });

  it("round-trips a pinned mode", () => {
    const theme = { ...DEFAULT_THEME, mode: "dark" as const };
    expect(parseTheme(serializeTheme(theme))).toEqual(theme);
  });

  it("falls back per field on a bad colour and keeps the good ones", () => {
    const raw = serializeTheme({ ...DEFAULT_THEME, accent: "#1F5F8B" })
      .replace("faf7f2", "zzzzzz");
    const theme = parseTheme(raw);
    expect(theme.accent).toBe("#1F5F8B");
    expect(theme.bg).toBe(DEFAULT_THEME.bg);
  });

  it("falls back to system on an unknown mode and to defaults on short input", () => {
    expect(parseTheme("v1.sepia.722f37").mode).toBe("system");
    expect(parseTheme("v1.light").mode).toBe("light");
    expect(parseTheme("v1.light").accent).toBe(DEFAULT_THEME.accent);
  });

  it("normalises colours to upper-case six-digit hex", () => {
    const theme = parseTheme(serializeTheme({ ...DEFAULT_THEME, accent: "#abcdef" }));
    expect(theme.accent).toBe("#ABCDEF");
  });
});

describe("presets and defaults", () => {
  it("are all valid hex and distinct from each other", () => {
    const ids = new Set<string>();
    for (const preset of PRESETS) {
      expect(ids.has(preset.id), preset.id).toBe(false);
      ids.add(preset.id);
      for (const key of COLOR_KEYS) {
        expect(preset.colors[key], `${preset.id}.${key}`).toMatch(HEX);
      }
    }
    for (const key of COLOR_KEYS) expect(DEFAULT_THEME[key]).toMatch(HEX);
    expect(DEFAULT_THEME.mode).toBe("system");
  });

  it("keeps Classic identical to the Android palette", () => {
    const classic = PRESETS.find((p) => p.id === "classic")!;
    expect({ ...classic.colors, mode: "system" }).toEqual(DEFAULT_THEME);
    expect(DEFAULT_THEME.accent).toBe("#722F37");
    expect(DEFAULT_THEME.bg).toBe("#FAF7F2");
  });

  it("knows when the theme is untouched", () => {
    expect(isDefaultTheme(DEFAULT_THEME)).toBe(true);
    expect(isDefaultTheme({ ...DEFAULT_THEME, mode: "light" })).toBe(false);
    expect(isDefaultTheme({ ...DEFAULT_THEME, accent: "#000000" })).toBe(false);
  });
});

describe("contrastText", () => {
  it("puts dark text on light badges and white on dark ones", () => {
    expect(contrastText("#FFFFFF")).toBe("#2D2D2D");
    expect(contrastText("#D4A03A")).toBe("#2D2D2D");
    expect(contrastText("#000000")).toBe("#FFFFFF");
    expect(contrastText("#722F37")).toBe("#FFFFFF");
    expect(contrastText("#8B7355")).toBe("#FFFFFF");
    // Mid tones: white only reaches ~2.7:1 on sage, charcoal reaches 5:1.
    expect(contrastText("#87A878")).toBe("#2D2D2D");
    expect(contrastText("#5B9BD5")).toBe("#2D2D2D");
  });
});

describe("cssVars", () => {
  it("emits one --user-* variable per colour plus a foreground for accent and each status", () => {
    const vars = cssVars(DEFAULT_THEME);
    expect(Object.keys(vars).sort()).toEqual([
      "--user-accent",
      "--user-accent-fg",
      "--user-bg",
      "--user-status-inventory",
      "--user-status-inventory-fg",
      "--user-status-posted",
      "--user-status-posted-fg",
      "--user-status-scheduled",
      "--user-status-scheduled-fg",
      "--user-status-sold",
      "--user-status-sold-fg",
      "--user-surface",
      "--user-text",
    ]);
    expect(vars["--user-accent"]).toBe("#722F37");
    expect(vars["--user-accent-fg"]).toBe("#FFFFFF");
    expect(vars["--user-status-posted-fg"]).toBe("#2D2D2D");
    expect(vars["--user-status-inventory-fg"]).toBe("#FFFFFF");
  });
});

describe("themeCookieString", () => {
  it("writes a cookie-safe, non-httpOnly preference like dg-lang", () => {
    const s = themeCookieString(DEFAULT_THEME, true);
    expect(s.startsWith(`${THEME_COOKIE}=v1.system.722f37.faf7f2.`)).toBe(true);
    expect(s.endsWith("; Path=/; Max-Age=31536000; SameSite=Lax; Secure")).toBe(true);
    expect(themeCookieString(DEFAULT_THEME, false).endsWith("SameSite=Lax")).toBe(true);
    // RFC 6265 cookie-octets: no quotes, commas, semicolons, spaces, or backslashes.
    expect(serializeTheme(DEFAULT_THEME)).toMatch(/^[!#-+\--:<-[\]-~]+$/);
  });
});
