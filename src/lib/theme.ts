// Per-device colour theme, stored in a cookie the same way as the UI language
// (see i18n.ts). It is read on the server so the first paint already carries
// the chosen colours instead of flashing burgundy first.

export const THEME_COOKIE = "dg-theme";
const MAX_AGE_SECONDS = 31536000;

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

// bgDark is last so an 8-colour v1 cookie still maps the original fields
// and the new dark background falls back per-field to the default.
export const COLOR_KEYS = [
  "accent",
  "bg",
  "surface",
  "text",
  "statusInventory",
  "statusScheduled",
  "statusPosted",
  "statusSold",
  "bgDark",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type ThemeColors = Record<ColorKey, string>;
export interface Theme extends ThemeColors {
  mode: ThemeMode;
}

// The Android palette from ui/theme/Color.kt, so "Classic" is the app she knows.
const CLASSIC: ThemeColors = {
  accent: "#722F37",
  bg: "#FAF7F2",
  surface: "#FFFFFF",
  text: "#2D2D2D",
  statusInventory: "#8B7355",
  statusScheduled: "#5B9BD5",
  statusPosted: "#D4A03A",
  statusSold: "#87A878",
  bgDark: "#1A1A1A",
};

export const DEFAULT_THEME: Theme = { ...CLASSIC, mode: "system" };

export type PresetId = "classic" | "ocean" | "forest" | "slate" | "blush" | "mono";

export const PRESETS: { id: PresetId; colors: ThemeColors }[] = [
  { id: "classic", colors: CLASSIC },
  {
    id: "ocean",
    colors: {
      accent: "#1F5F8B", bg: "#F2F7FA", surface: "#FFFFFF", text: "#1E2A33",
      statusInventory: "#6C8393", statusScheduled: "#3F8FC9",
      statusPosted: "#E0A533", statusSold: "#4FA383", bgDark: "#0E161C",
    },
  },
  {
    id: "forest",
    colors: {
      accent: "#2F5D3A", bg: "#F4F6F0", surface: "#FFFFFF", text: "#232B22",
      statusInventory: "#7E8A6C", statusScheduled: "#4C8DB5",
      statusPosted: "#D8A93B", statusSold: "#5E9E6C", bgDark: "#121612",
    },
  },
  {
    id: "slate",
    colors: {
      accent: "#3B4A5C", bg: "#F5F6F8", surface: "#FFFFFF", text: "#1F252D",
      statusInventory: "#7A8794", statusScheduled: "#5B8DD9",
      statusPosted: "#D9A441", statusSold: "#5FA987", bgDark: "#121418",
    },
  },
  {
    id: "blush",
    colors: {
      accent: "#B8546C", bg: "#FBF4F5", surface: "#FFFFFF", text: "#302428",
      statusInventory: "#A08B90", statusScheduled: "#6C9BD2",
      statusPosted: "#E3A93E", statusSold: "#7FAE8B", bgDark: "#161213",
    },
  },
  {
    id: "mono",
    colors: {
      accent: "#222222", bg: "#F7F7F7", surface: "#FFFFFF", text: "#111111",
      statusInventory: "#8A8A8A", statusScheduled: "#5A5A5A",
      statusPosted: "#BDBDBD", statusSold: "#3D3D3D", bgDark: "#111111",
    },
  },
];

const HEX6 = /^#?([0-9a-f]{6})$/i;

function normaliseHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = HEX6.exec(raw.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

// Cookie format: `v1.<mode>.<9 hex colours without #>` joined by dots. Every
// character is a cookie-octet, so the value survives Set-Cookie and document.cookie
// without percent-encoding, and a truncated or corrupted value still parses
// field by field. JSON would need encoding and fail as a whole on one bad byte.
export function serializeTheme(theme: Theme): string {
  const parts = [
    "v1",
    theme.mode,
    ...COLOR_KEYS.map((k) => theme[k].slice(1).toLowerCase()),
  ];
  return parts.join(".");
}

export function parseTheme(raw: string | undefined | null): Theme {
  const theme: Theme = { ...DEFAULT_THEME };
  if (!raw) return theme;
  const parts = raw.split(".");
  if (parts[0] !== "v1") return theme;
  const mode = parts[1];
  if ((THEME_MODES as readonly string[]).includes(mode)) theme.mode = mode as ThemeMode;
  COLOR_KEYS.forEach((key, i) => {
    const hex = normaliseHex(parts[2 + i]);
    if (hex) theme[key] = hex;
  });
  return theme;
}

export function isDefaultTheme(theme: Theme): boolean {
  return serializeTheme(theme) === serializeTheme(DEFAULT_THEME);
}

export function themeCookieString(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${serializeTheme(theme)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

export function clearThemeCookieString(): string {
  return `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

const WHITE = "#FFFFFF";
const CHARCOAL = "#2D2D2D";

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** White or charcoal, whichever has the higher WCAG contrast on `hex`, so a badge
 *  stays legible whatever colour she mixes for it. */
export function contrastText(hex: string): string {
  const l = relativeLuminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onCharcoal = (l + 0.05) / (relativeLuminance(CHARCOAL) + 0.05);
  return onWhite >= onCharcoal ? WHITE : CHARCOAL;
}

const VAR_NAMES: Record<ColorKey, string> = {
  accent: "--user-accent",
  bg: "--user-bg",
  surface: "--user-surface",
  text: "--user-text",
  statusInventory: "--user-status-inventory",
  statusScheduled: "--user-status-scheduled",
  statusPosted: "--user-status-posted",
  statusSold: "--user-status-sold",
  bgDark: "--user-bg-dark",
};

const STATUS_KEYS: ColorKey[] = [
  "statusInventory", "statusScheduled", "statusPosted", "statusSold",
];

/** Inline variables for `<html>`. Only `--user-*` names, never the semantic
 *  tokens themselves: globals.css resolves those, which is what lets dark mode
 *  still override the neutrals. */
export function cssVars(theme: Theme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of COLOR_KEYS) out[VAR_NAMES[key]] = theme[key];
  out["--user-accent-fg"] = contrastText(theme.accent);
  for (const key of STATUS_KEYS) out[`${VAR_NAMES[key]}-fg`] = contrastText(theme[key]);
  return out;
}

export type ThemeColorEntry = { color: string; media?: string };

/** Page background for the current appearance. `prefersDark` is only
 *  consulted when mode is "Match phone" — Android Chrome ignores
 *  media-queried theme-color metas and then paints the status bar white. */
export function resolvedChromeBackground(theme: Theme, prefersDark = false): string {
  if (theme.mode === "dark") return theme.bgDark;
  if (theme.mode === "light") return theme.bg;
  return prefersDark ? theme.bgDark : theme.bg;
}

/** Manifest / first-paint chrome. System mode assumes light; the client
 *  ThemeColorSync corrects it from matchMedia. */
export function chromeBackground(theme: Theme): string {
  return resolvedChromeBackground(theme, false);
}

export function themeColorEntries(theme: Theme, prefersDark = false): ThemeColorEntry[] {
  return [{ color: resolvedChromeBackground(theme, prefersDark) }];
}

/** Always a single colour, never a media-query list. Android standalone
 *  dropped every media-only tag and fell back to a white status bar. */
export function viewportThemeColor(theme: Theme): string {
  return chromeBackground(theme);
}

export function applyThemeColorMeta(doc: Document, theme: Theme): void {
  const prefersDark =
    typeof doc.defaultView?.matchMedia === "function" &&
    doc.defaultView.matchMedia("(prefers-color-scheme: dark)").matches;
  const color = resolvedChromeBackground(theme, prefersDark);

  // Removing the node unbinds Chrome's status-bar listener; it then
  // stays white for the rest of the session. Rewrite content in place.
  let primary = doc.querySelector('meta[name="theme-color"]:not([media])');
  if (!primary) {
    primary = doc.createElement("meta");
    primary.setAttribute("name", "theme-color");
    const head = doc.head ?? doc.documentElement;
    head.insertBefore(primary, head.firstChild);
  }
  primary.setAttribute("content", color);

  for (const el of doc.querySelectorAll('meta[name="theme-color"][media]')) {
    el.remove();
  }
}

/** Apply a theme to a live document without a reload. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  for (const [name, value] of Object.entries(cssVars(theme))) {
    root.style.setProperty(name, value);
  }
  root.classList.remove("light", "dark");
  if (theme.mode !== "system") root.classList.add(theme.mode);
  const doc = root.ownerDocument;
  if (doc) applyThemeColorMeta(doc, theme);
}
