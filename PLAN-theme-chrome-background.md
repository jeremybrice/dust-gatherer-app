# PWA chrome colour + separate light/dark backgrounds

The installed-app top bar stays Classic burgundy, and Dark mode still
hard-codes one page background. Fix both from the existing theme cookie.

## Why

`viewport.themeColor` and the live `theme-color` meta are set to **accent**,
and `public/manifest.webmanifest` ships a static `theme_color` of `#722F37`.
Android standalone chrome uses that install-time manifest colour, so every
palette still shows burgundy at the top.

Dark mode overrides `--bg` to `#1A1A1A` and ignores the user's Background
swatch. There is only one Background row, so Light and Dark cannot keep
different page colours.

## Approach

1. Add `bgDark` as a ninth cookie field, **appended** so existing 8-colour
   `v1` cookies still parse. Light `bg` is unchanged.
2. Dark CSS reads `--user-bg-dark` instead of a hardcoded hex. Surface and
   text stay the built-in dark neutrals.
3. PWA chrome (`theme-color` meta, `generateViewport`, manifest
   `theme_color`) uses the **resolved page background**: light `bg` when
   mode is `light` or `system`, `bgDark` when mode is `dark`. System mode
   also emits media-query metas so the phone's scheme is honoured.
4. Serve the manifest from a route that reads `dg-theme`, and stop
   precaching it in the service worker so a palette change can take effect
   without reinstalling.

## Tasks

- [x] Extend `tests/unit/theme.test.ts`: `bgDark` round-trip, old 8-colour
      cookies default `bgDark`, `cssVars` emits `--user-bg-dark`,
      `themeColorEntries` / `chromeBackground` follow background not accent.
- [x] Extend `src/lib/theme.ts` to make those pass. Each preset gets a
      matching dark page colour; Classic stays `#1A1A1A`.
- [x] `globals.css`: dark `--bg: var(--user-bg-dark, #1A1A1A)`.
- [x] `layout.tsx` `generateViewport` uses `themeColorEntries`.
- [x] `ThemeEditor`: two background rows; `applyTheme` writes the
      `theme-color` meta(s).
- [x] Dynamic `/manifest.webmanifest` from the cookie; delete the static
      file; drop it from the SW precache (`dg-shell-v2`).
- [x] i18n: `color_background_light` / `color_background_dark`.
- [ ] `npm test`, `npm run typecheck`, browser check of Settings colours.
