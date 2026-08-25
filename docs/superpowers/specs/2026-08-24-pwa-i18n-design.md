# PWA install + EN/UK i18n design

Date: 2026-08-24
Status: awaiting review

## Purpose

Make Dust Gatherer installable as a standalone PWA on iPhone and Android, and restore
the Android language switcher: English and Ukrainian, default English, remembered on
this device. The live UI is hardcoded English and there is no manifest, service worker,
or icon set, so the app cannot be installed despite the project’s framing.

## Out of scope

- Theme (system / light / dark)
- Calendar / Schedule
- Category and site management UI
- Bulk select
- Offline-first (IndexedDB, sync queue, caching authenticated HTML or API JSON)
- `next-intl`, locale-prefixed URLs (`/uk/…`), Workbox / Serwist
- Language stored in Postgres (Android was per-device; a cookie matches that)
- Generating icons during the Netlify build (the `sharp` macOS/Linux trap)

## Decisions already made

- Approach: static files under `public/` plus a `dg-lang` cookie and committed JSON
  dictionaries. No new tables, no new npm i18n/PWA libraries.
- Settings is the shared control surface: language radios, then install, then the
  existing Export / Import links.
- Default language is English. Radios are **English** and **Українська**, same labels
  as Android (`AppLanguage.displayName`).
- iPhone and Android are both first-class install targets.
- JSON dictionaries are the live source. `i18n/android/*.xml` remains the Android
  reference and is not read at runtime.
- Translate every user-visible chrome string in the current web app. Do not port
  unused Android keys (calendar, theme, category/site management, old analytics
  labels). Item titles, categories, sites, notes, and the passphrase are user data
  and stay as stored.

## Architecture

Two subsystems, one Settings surface, no schema changes.

| Piece | Where | Job |
|---|---|---|
| Manifest, SW, icons | `public/` | Meet install criteria; stay public in middleware |
| Offline fallback | `src/app/offline/page.tsx` | Public bilingual page; URL `/offline` |
| SW registration | client component in root layout | Runs on every page, including `/login` |
| Language cookie | `dg-lang=en\|uk` | Preference for SSR, `html lang`, and login |
| Dictionaries | `i18n/en.json`, `i18n/uk.json` | Chrome copy |
| `t(lang, key, vars?)` | `src/lib/i18n.ts` | Only lookup API |
| `I18nProvider` | root layout | Passes bound `t` and `lang` to the tree |
| Settings | `/settings` | Radios + install block + existing links |

Middleware already allows `/manifest.webmanifest`, `/sw.js`, `/offline`, `/icons/`
without a session. Do not add those paths to the auth gate. Do not add `[[headers]]`
to `netlify.toml`.

## PWA shell

### Manifest

`public/manifest.webmanifest`:

- `name` / `short_name`: Dust Gatherer
- `display`: `standalone`
- `start_url`: `/`
- `theme_color`: `#722F37` (Burgundy)
- `background_color`: `#FAF7F2` (Cream)
- icons: 192 PNG, 512 PNG, 512 maskable PNG (`purpose: "maskable"`)

Root layout already sets `viewport.themeColor` and `viewportFit: cover`. Add:

- `<link rel="manifest" href="/manifest.webmanifest">`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`

iOS ignores manifest icons; the Apple link is required.

### Icons

Generated once from `public/icons/source.png` by a local script, then committed.
Netlify’s build does not run the script.

| File | Size | Notes |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Manifest |
| `public/icons/icon-512.png` | 512×512 | Manifest |
| `public/icons/icon-512-maskable.png` | 512×512 | Logo inset ~20% so adaptive icons do not crop it |
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home screen |

`source.png` stays the master.

### Service worker

`public/sw.js`, scope `/`. Chrome requires a registered worker with a `fetch`
handler even though this app is not offline-first.

- Precache: `/offline`, icons, `/manifest.webmanifest` only. Not Next.js HTML, not
  `/_next/static/*` (hashed assets change every deploy; precaching them stale-locks
  the shell).
- Navigations: network-first. If the network fails, `/offline`.
- All `/api/*` (including images): network only. Never put API responses in the
  SW cache. (The image route’s own `Cache-Control: immutable` still lets the
  browser HTTP cache reuse photos while signed in. A SW cache would keep serving
  them after logout.)
- `skipWaiting()` + `clients.claim()` so a new deploy is not stuck behind an old
  worker.

Middleware sets `Cache-Control: no-cache` on `/sw.js` so Chrome does not keep a
stale worker. Do not add this in `netlify.toml`.

Registration: a client component mounted from root layout. If `navigator.serviceWorker`
is missing or `register` throws, catch, `console.error`, and continue. No banner.

`src/app/offline/page.tsx` is public (middleware already allows `/offline`). Copy
is hardcoded bilingual, no dictionary: heading “Dust Gatherer”, body
“You’re offline. / Ви офлайн.” No inventory, no login form.

### Install UI on Settings

A client `InstallPanel` on `/settings`.

**Already installed** when `window.matchMedia("(display-mode: standalone)").matches`
or iOS `navigator.standalone` is true: show a single “Installed” line; hide the
Chrome button and the iPhone steps.

**Android / Chrome:** listen for `beforeinstallprompt`, `preventDefault`, keep the
event, show **Install app**. Click calls `event.prompt()`. On `appinstalled` or
accepted outcome, hide the button. If the event never fires, the button is absent
(desktop Chrome can still use the omnibox). Do not re-prompt in the same session
after a dismiss.

**iPhone:** no `beforeinstallprompt`. When the client is iOS Safari (iPhone/iPod,
or iPadOS: `navigator.platform === "MacIntel" && maxTouchPoints > 1`) and not
standalone, show numbered steps: Share → Add to Home Screen. Do not show those
steps on Android or desktop.

## Language

### Cookie

| | |
|---|---|
| Name | `dg-lang` |
| Values | `en` or `uk` |
| Default | missing, empty, or anything else → `en` |
| Attributes | `Path=/`, `Max-Age=31536000` (365 days), `SameSite=Lax`, `Secure` when the page is HTTPS |
| `httpOnly` | no — Settings writes it from the client |

Settings radios set the cookie and `location.reload()`. No `/api/locale` route.

Root layout is a server component: `cookies().get("dg-lang")`, parse, set
`<html lang="en">` or `<html lang="uk">`, wrap children in `I18nProvider`.

### Dictionaries and `t()`

```ts
export type Lang = "en" | "uk";
export function parseLang(raw: string | undefined | null): Lang;
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string;
```

`t` looks up `key` in the chosen dictionary; if missing, the English value; if that
is also missing, the key itself (so tests fail loudly). Placeholders match Android
only: `%1$s`, `%1$d`, `%2$s`. Do not throw on a missing key. No named `{name}`
placeholders. No plural-rule logic (`login_rate_limited` always uses “minutes”).

`I18nProvider` exposes `{ lang, t: (key, vars?) => t(lang, key, vars) }`. Client
components use a `useT()` hook. Server components call `t(lang, key)` directly
after reading the cookie. Do not import JSON from feature components.

### What gets translated

Every chrome string the current app renders: login (including error messages),
document titles (`<title>` / `metadata.title`), tabs (Home / Inventory / Settings),
Add, Home dashboard (period toggle, cards, strips, empty state), inventory search /
chips / headings / empty / match-none, item form and dialogs, export/import copy
already on those pages, Settings headings, install copy.

Money and month names follow the UI language: `en-US` when `lang === "en"`,
`uk-UA` when `lang === "uk"`, currency still USD. `formatMoney` (on `main`,
`src/lib/money.ts`) and `monthLabel` take a locale or `lang`. Status badges
use translated labels (`status_in_stock` etc.), not the raw `INVENTORY` enum.

### New keys (not in Android XML)

Home, tabs, login, and install have no Android source. Both dictionaries must
include them. English source of truth:

| Key | English |
|---|---|
| `home` | Home |
| `add` | + Add |
| `all_time` | All-time |
| `sales_profit` | Sales profit |
| `sales_profit_this_month` | Sales profit this month |
| `revenue` | revenue |
| `sold_count` | %1$d sold |
| `on_the_shelf` | On the shelf |
| `unsold_count` | %1$d unsold |
| `posted_waiting` | Posted, waiting |
| `listed_not_sold` | listed, not sold |
| `stale_gt_days` | Stale > %1$d days |
| `gt_days` | > %1$d days |
| `oldest_on_the_shelf` | Oldest on the shelf |
| `see_all` | See all |
| `days_paid` | %1$d days · paid %2$s |
| `stale` | stale |
| `recently_sold` | Recently sold |
| `sold_this_month` | Sold this month |
| `sold_profit` | Sold %1$s · Profit %2$s |
| `chip_all` | All |
| `chip_unsold` | Unsold |
| `chip_stale` | Stale |
| `paid` | Paid %1$s |
| `profit` | Profit %1$s |
| `clear` | Clear |
| `no_items_match` | No items match. |
| `sign_in` | Sign in |
| `signing_in` | Signing in… |
| `passphrase` | Passphrase |
| `login_tagline` | Enter your passphrase to continue. |
| `login_wrong` | That passphrase is not right. |
| `login_unconfigured` | The server is not configured yet. |
| `login_offline` | Could not reach the server. Check your connection. |
| `login_rate_limited` | Too many attempts. Try again in %1$d minutes. |
| `install_app` | Install app |
| `installed` | Installed |
| `install_ios_title` | Add to Home Screen |
| `install_ios_share` | Tap Share |
| `install_ios_add` | Tap Add to Home Screen |
| `language_en` | English |
| `language_uk` | Українська |

Ukrainian values for these keys are authored in this increment, not machine-left
as English. Existing Android UK strings are reused where the web chrome still
matches (Settings, inventory search, item form, export/import, status labels).

Drop from the port: calendar keys, theme keys, category/site management keys,
and the old UK analytics keys (`financial_summary`, `total_spent`, …) that do
not match the live Home dashboard.

## Settings

`/settings` stays behind `requireSession` and keeps the tab bar. Order:

1. **Language** — two radios, selected from `lang`. Changing one writes `dg-lang`
   and reloads. Labels are always “English” and “Українська”, not translated
   into the other language (Android displayed `displayName` this way).
2. **Install** — `InstallPanel` as specified above.
3. **Data** — existing Export data / Import data links, now using `t()` for the
   titles and descriptions already in the Android XML (`export_data`,
   `export_description`, `import_data`, `import_description`).

Export and import pages themselves are translated with the same provider; they
do not gain a tab bar.

## Error handling

- SW registration failure: app remains a normal website. No retry loop.
- `beforeinstallprompt` absent: Chrome button absent. iPhone steps only on iOS
  Safari when not standalone.
- Cookie write failure: radios do not change apparent selection; language stays
  as parsed from the existing cookie.
- Missing UK string: English. Missing both: the key.
- Failed API: existing in-page errors, translated. The worker never synthesizes
  a cached inventory.
- Logout: because authenticated HTML and API JSON are not cached, a stale signed-in
  page cannot appear.

## Testing

Vitest only. No Playwright, no new PGlite cases, no browser install automation.

- `parseLang`: `undefined`, `""`, `"en"`, `"uk"`, `"UK"`, `"fr"` → `en`, `en`,
  `en`, `uk`, `en`, `en`.
- `t`: `%1$s` / `%1$d` interpolation; missing UK key falls back to English;
  missing both returns the key.
- Dictionaries: every `en.json` key exists in `uk.json` with a non-empty value
  that is not identical to English unless the string is a proper noun or a
  language name left the same in both files (`app_name`, `language_en`,
  `language_uk`). No unused Android-only keys.
- `formatMoney` / month label: `en` vs `uk` produce different locale strings
  for the same number / date.
- Manifest file parses as JSON, `display === "standalone"`, `start_url === "/"`,
  has 192, 512, and maskable icons, `theme_color === "#722F37"`.
- Middleware `PUBLIC` still matches `/manifest.webmanifest`, `/sw.js`,
  `/offline`, and `/icons/icon-192.png`.
- `public/sw.js` contains a `fetch` handler and does not `cache.put` any URL
  whose path starts with `/api/`.

Manual after deploy (not CI): Chrome install, iPhone Add to Home Screen, switch
to Українська and confirm login, Home, tabs, and Settings.

## Risks

- **Installability vs auth.** A redirected `/sw.js` or `/manifest.webmanifest`
  fails Chrome’s criteria with no obvious error. Mitigation: keep the existing
  middleware public list; test it.
- **Stale SW after deploy.** A worker that precaches `/_next/static` HTML will
  serve a broken shell. Mitigation: precache only offline + icons + manifest;
  navigations are network-first; `skipWaiting` + `clients.claim`.
- **Cached inventory leak.** Mitigation: never cache `/api/*` (JSON or images)
  or HTML documents in the service worker.
- **SSR language flash.** `localStorage` would paint English then swap.
  Mitigation: cookie read in the root layout.
- **Ukrainian Home copy.** Android XML does not cover the command center.
  Mitigation: new keys listed above; both dictionaries required by test.
- **Icon generation on Netlify.** `sharp` built on macOS breaks Linux
  functions. Mitigation: generate locally, commit PNGs, do not call `sharp`
  at deploy time.
- **Local `main` is behind origin.** This spec assumes the Home command center
  already on origin (`AppShell`, `/inventory`, `/settings`, `src/lib/money.ts`).
  Implementation starts from updated `main`.
