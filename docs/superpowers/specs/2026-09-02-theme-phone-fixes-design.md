# Customizable theme + iPhone quick fixes: design

**Date:** 2026-09-02
**Status:** approved

## Why

The shop owner uses the app on an iPhone 17 Pro (402pt wide) in Ukrainian. Her feedback,
interpreted by intent:

1. Content "disappears beyond the edges of the screen" and she cannot find the way to
   Inventory and Settings. The only navigation is the fixed bottom tab bar; the two-column
   grids on Home and the item form are hard `1fr 1fr`, and Ukrainian labels and `uk-UA` money
   are much longer than English.
2. The burgundy palette irritates her. She wants to choose her own colours, mixing and
   matching rather than picking one of ours.
3. She likes the filter chips but cannot tell "Не продані" (unsold) from "Заплановано"
   (scheduled). That is a real flaw: the chip row mixes exclusive statuses with
   cross-cutting sets, and nothing on a scheduled row shows its scheduled date.
4. She wants 50 or 100 items per screen; today the list renders every match at once.

Out of scope here, pending her answers: "slides" for Posted/Sold, AI descriptions,
Calendar/Schedule, category and site management.

## Theme

### Storage

A `dg-theme` cookie on the device, mirroring `dg-lang`: not `httpOnly`, `Path=/`,
`Max-Age=31536000`, `SameSite=Lax`, `Secure` on HTTPS. Value is compact JSON. Read on the
server in `layout.tsx` so the first paint already has her colours (no flash). No schema
change; each device keeps its own theme, which is acceptable for a single user on one phone.

### Tokens

Eight colours she controls, plus a mode:

- `accent` (headings, links, buttons, active chip, active tab; default `#722F37`)
- `bg` (page background; default `#FAF7F2`)
- `surface` (cards and inputs; default `#FFFFFF`)
- `text` (default `#2D2D2D`)
- `statusInventory`, `statusScheduled`, `statusPosted`, `statusSold` (badge colours;
  defaults taupe `#8B7355`, `#5B9BD5`, gold `#D4A03A`, sage `#87A878`)
- `mode`: `system` (default) | `light` | `dark`

Everything else is derived so a mix she chooses stays coherent:

- `--text-muted`, `--border` via `color-mix()` of text and background
- `--accent-soft` (chip and stale-pill background) via `color-mix()` of accent and surface
- `--positive` (profit figure) stays the sold status colour
- Badge foreground is white or charcoal chosen by relative luminance of the badge colour
  (`contrastText`), so she cannot pick an unreadable badge.

### Dark mode

Her base colours (`bg`, `surface`, `text`) define the light palette. In `system` mode the
built-in dark neutrals still apply when the phone is dark; her accent and status colours
apply in both. `light` pins her palette regardless of the phone; `dark` pins the built-in
dark neutrals. This is implemented with an indirection: the layout writes `--user-*`
variables inline on `<html>`, and `globals.css` resolves `--bg: var(--user-bg, default)`
under a light rule and overrides with dark neutrals under `html.dark` and under
`@media (prefers-color-scheme: dark)` for `html:not(.light)`.

### Editor

A `ThemeEditor` block on Settings, after Language:

- Mode radios: System / Light / Dark.
- Presets row (Classic, Ocean, Forest, Slate, Blush, Mono). Tapping one fills all eight
  colours; presets are starting points, not the end of the choice.
- "Main colours": accent, background, cards, text. "Status colours": in stock, scheduled,
  posted, sold. Each row is a native `<input type="color">` (iOS shows a real picker) with
  a swatch and translated label.
- Every change applies immediately to `document.documentElement` and rewrites the cookie.
  No reload, unlike language, because CSS variables update live.
- A preview strip (stat card, chip, four badges) inside the block.
- "Reset to default" deletes the cookie and reloads.

`viewport.themeColor` becomes `generateViewport()` reading the cookie so the iOS status
bar and installed-app chrome follow the accent. `manifest.webmanifest` `theme_color` stays
static; it only affects the splash.

### Validation

`parseTheme` never throws. Each colour must match `/^#[0-9a-f]{6}$/i`; anything else falls
back per field to the default. Unknown keys are dropped. Mode falls back to `system`.

## iPhone fixes

### Overflow and tab bar

The exact clipping is unconfirmed (no screenshot yet), so this is a defensive pass at
402pt with Ukrainian copy:

- `.stats` and `.row2` use `repeat(2, minmax(0, 1fr))`; `.stat`, `.item .body`, `.field`
  get `min-width: 0`; long values get `overflow-wrap: anywhere`; `.stat .v` uses `clamp()`.
- `html, body { overflow-x: hidden }` backstop; `img { max-width: 100% }`.
- The tab bar pads with `max(0.5rem, env(safe-area-inset-bottom))` and `body` stops adding
  its own bottom safe-area padding so the bar is not pushed under the iOS Safari toolbar.
  `.shelled` reserves room for the bar.
- Verified with Playwright at 402x874 and `dg-lang=uk` where a database is available;
  otherwise on the Netlify deploy.

Non-code recommendation: install from Settings (Share, Add to Home Screen) so Safari's
toolbar can never sit over the tabs.

### Chips

Two rows. Statuses: All, In stock, Scheduled, Posted, Sold. Views: On the shelf, Stale,
styled differently and labelled. `chip_unsold` is renamed "On the shelf" / "На полиці" so the
chip, the list heading (`FILTER_KEYS.unsold` is already `on_the_shelf`) and the Home card
agree. Scheduled rows show "Scheduled for {date}"; posted rows show "Posted {date}".

### Page size

`?limit=50|100|all`, default 50, carried by `inventoryHref` only when not default. The list
renders the first `limit` matches, shows "Showing N of M", a "Show 50 more" button (local
state), and a 50 / 100 / All selector that rewrites the URL. The heading keeps the full
count so filter totals do not change meaning.

## Testing

- `tests/unit/theme.test.ts`: parse and fallback, cookie string, `contrastText`, presets
  valid, `cssVars` shape.
- `tests/unit/inventoryStats.test.ts`: `parseLimit`, `inventoryHref` with `limit`.
- Existing `i18n.test.ts` key-parity test covers new strings.
- `npm test`, `npm run typecheck`, `npm run build` before the PR.
