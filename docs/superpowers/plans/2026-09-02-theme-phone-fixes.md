# Customizable Theme + iPhone Quick Fixes Implementation Plan

**Goal:** Let the shop owner mix and match the app's colours from Settings, and fix the
phone-width problems she reported: clipping and a hidden tab bar, confusing filter chips,
and no page size on Inventory.

**Architecture:** A `dg-theme` cookie (same pattern as `dg-lang`) parsed in `layout.tsx`
and emitted as `--user-*` CSS variables on `<html>`. `globals.css` moves to semantic tokens
with defaults, so the inline variables override only what she set and dark mode keeps
working. A `ThemeEditor` client component on Settings applies changes live and writes the
cookie. Inventory gains a `limit` query param and two chip rows.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Vitest. No new dependencies,
no schema changes.

**Spec:** [docs/superpowers/specs/2026-09-02-theme-phone-fixes-design.md](../specs/2026-09-02-theme-phone-fixes-design.md)

## Global constraints

- Cookie `dg-theme` is never `httpOnly`; the client writes it. Parsing never throws.
- Only `--user-*` variables go inline on `<html>`; every consumer reads the semantic token
  (`--accent`, `--bg`, ...) resolved in `globals.css`. Never inline `--bg` directly or dark
  mode cannot override it.
- Middleware is untouched. Nothing here runs on the edge.
- No Playwright in CI. Browser verification is manual (local dev or Netlify deploy).
- Branch `theme-phone-fixes`, PR to `main`. Do not stage the uncommitted `CLAUDE.md`
  Relay block, `.claude/skills/`, or `.relay/`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/theme.ts` (create) | Tokens, defaults, presets, `parseTheme`, `themeCookieString`, `cssVars`, `contrastText` |
| `tests/unit/theme.test.ts` (create) | Unit tests for the above |
| `src/app/globals.css` (modify) | Semantic tokens, `--user-*` indirection, mode classes, overflow and tab bar fixes, chip rows, theme editor styles |
| `src/app/layout.tsx` (modify) | Read cookie, `<html class style>`, `generateViewport` |
| `src/components/ThemeEditor.tsx` (create) | Settings block: mode, presets, colour inputs, preview, reset |
| `src/app/settings/page.tsx` (modify) | Mount `ThemeEditor` after `LanguageRadios` |
| `i18n/en.json`, `i18n/uk.json` (modify) | Theme, chip group, scheduled/posted date, page size strings |
| `src/lib/inventoryStats.ts` (modify) | `InventoryLimit`, `parseLimit`, `inventoryHref` with `limit` |
| `src/app/inventory/page.tsx` (modify) | Pass `limit` through |
| `src/components/InventoryList.tsx` (modify) | Two chip rows, dates on rows, paging footer |
| `tests/unit/inventoryStats.test.ts` (modify) | `parseLimit`, `inventoryHref` |
| `CLAUDE.md`, `docs/handoff.md` (modify) | Current-state lists |

---

### Task 1: Theme library

- [ ] Write `tests/unit/theme.test.ts` covering: defaults when cookie missing or garbage;
  per-field fallback on bad hex; unknown keys dropped; mode fallback; cookie string flags;
  `contrastText("#FFFFFF")` is charcoal and `contrastText("#000000")` is white; every
  preset validates through `parseTheme` unchanged; `cssVars` emits exactly the eight
  `--user-*` colour keys plus the four `--user-status-*-fg` keys.
- [ ] Create `src/lib/theme.ts` to make them pass.
- [ ] `npx vitest run tests/unit/theme.test.ts`.

### Task 2: CSS tokens and layout wiring

- [ ] In `globals.css`, define `:root` semantic tokens from `--user-*` with defaults; add
  `html.dark` and `@media (prefers-color-scheme: dark) html:not(.light)` neutral overrides;
  replace every direct `--burgundy` / `--cream` / `--sage` / `#f3e6e7` use with the
  semantic token. Badge text uses `--status-*-fg`.
- [ ] In `layout.tsx`, parse `dg-theme`, set `className={theme.mode}` (omit for `system`)
  and `style={cssVars(theme)}` on `<html>`; export `generateViewport` returning the accent.
- [ ] `npm run typecheck`; visual check that the default look is unchanged.

### Task 3: ThemeEditor

- [ ] Add i18n keys (en + uk): `theme`, `theme_mode`, `mode_system`, `mode_light`,
  `mode_dark`, `theme_presets`, `preset_classic`, `preset_ocean`, `preset_forest`,
  `preset_slate`, `preset_blush`, `preset_mono`, `main_colors`, `color_accent`,
  `color_background`, `color_cards`, `color_text`, `status_colors`, `reset_theme`,
  `theme_preview`.
- [ ] Create `src/components/ThemeEditor.tsx`: state seeded from a `theme` prop (server
  parsed), mode radios, preset buttons, eight colour rows, preview strip, reset. On each
  change: `applyTheme(document.documentElement, next)` and `document.cookie = ...`.
- [ ] Mount in `settings/page.tsx` with the parsed theme.
- [ ] Styles in `globals.css`: `.swatches`, `.color-row`, `.preview`.
- [ ] `npm test`.

### Task 4: Overflow and tab bar

- [ ] `globals.css`: `minmax(0, 1fr)` grids, `min-width: 0`, `overflow-wrap: anywhere`,
  `clamp()` on `.stat .v`, `overflow-x: hidden`, `img { max-width: 100% }`, tab bar
  safe-area padding, body bottom padding removed.
- [ ] If a database is reachable, run the dev server and check with Playwright at
  402x874 with `dg-lang=uk`: `scrollWidth === clientWidth` on Home, Inventory, item form;
  tab bar bottom within the viewport. Otherwise note it for the deploy check.

### Task 5: Chips and dates on rows

- [ ] i18n: rename `chip_unsold` values to "On the shelf" / "На полиці"; add
  `chip_group_status`, `chip_group_views`, `scheduled_for` (`Scheduled for %1$s`),
  `posted_on` (`Posted %1$s`).
- [ ] `InventoryList.tsx`: `STATUS_CHIPS` and `VIEW_CHIPS`, two `.chips` rows (second
  `.chips.views` with a small label), meta shows scheduled or posted date.
- [ ] `globals.css`: `.chips.views a` outlined style; `.chips-label`.

### Task 6: Page size

- [ ] Tests: `parseLimit(undefined) === 50`, `"100"` → 100, `"all"` → "all", junk → 50;
  `inventoryHref({ limit: 50 }) === "/inventory"`, `{ limit: 100 }` →
  `/inventory?limit=100`.
- [ ] `inventoryStats.ts`: `InventoryLimit = 50 | 100 | "all"`, `DEFAULT_LIMIT`,
  `parseLimit`, `inventoryHref` `limit`.
- [ ] `inventory/page.tsx` passes `limit`; `InventoryList` slices, shows footer with
  `showing_of`, `show_more`, and 50 / 100 / All selector (`per_page`).
- [ ] i18n keys: `showing_of` (`Showing %1$d of %2$d`), `show_more` (`Show %1$d more`),
  `per_page` (`Per page`), `all_items_option` (`All`).

### Task 7: Verify and ship

- [ ] `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Update `CLAUDE.md` Current state and `docs/handoff.md`.
- [ ] Commit, push `theme-phone-fixes`, open PR to `main`.
- [ ] After Netlify deploy: on her iPhone, Settings shows Theme; picking a preset and a
  single colour changes the app immediately; Reset restores burgundy; no horizontal
  scroll on Home / Inventory / item form in Ukrainian; tabs visible; Inventory shows
  50 with "Show 50 more" and the 50 / 100 / All selector.
