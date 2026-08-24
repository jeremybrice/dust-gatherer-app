# Home command center design

Date: 2026-08-24
Status: awaiting review

## Purpose

Make the PWA a daily driver for “is the business working?”, not a clone of the Android
screens. The app currently opens on an unfiltered list of 208 items. This increment puts a
command-center Home at `/`, moves the working list to `/inventory` with search and filters,
and makes every Home number a tap through to the matching items.

Capture, schedule, sell, and measure remain the jobs. Only measure is redesigned here.
Calendar, PWA install, and i18n stay later projects.

## Out of scope

- Calendar / Schedule tab
- PWA shell (manifest, service worker, install flow)
- EN/UK i18n
- Bulk select
- Category and site management UI (item-form dropdowns keep reading existing rows)
- A separate analytics page — Home is that page
- A Settings control for the stale threshold (60 days is fixed)
- A sell-through card (dropped from the command-center density; can return later)
- Swipe-to-post / swipe-to-sold on the list
- New database tables, migrations, or mutation APIs

## Decisions already made

- Redesign the web app as a better daily driver rather than restoring Android layout.
- Opening the app is a snapshot: this month’s sales profit, cash on the shelf, and whether
  stock is moving — not the full inventory.
- This month is in the foreground; all-time is a second look. The toggle changes *flow*
  numbers only. Stock numbers (shelf, posted-waiting, stale) do not have a month.
- Tapping a number opens the matching items on Inventory, not a category/site breakdown.
- Stale = unsold more than 60 days since `purchaseDate`. The count is tappable.
- Command-center Home: compact stats, then oldest unsold, then recent sales.
- Bottom tabs: Home · Inventory · Settings. Add item is an action, not a tab.
- No new writes. `listItems()` already returns every row; Home and Inventory derive from it.

## Screens and navigation

Three destinations:

| Destination | Route | Job |
|---|---|---|
| Home | `/` | Command center |
| Inventory | `/inventory` | Search, filters, full list. Home taps land here already filtered |
| Settings | `/settings` | Hub linking to existing `/settings/export` and `/settings/import` |

Add item remains `/items/new`. Edit remains `/items/[id]`. After a successful save, mark as
sold, or delete, and on Cancel, the form returns to `/inventory` (the list), not Home.

`AppShell` renders the bottom tabs on Home, Inventory, and Settings only. Item create/edit
stay a full-page form with Cancel and no tabs. One Add control per shelled screen (header
“+ Add”), linking to `/items/new`. Do not also render a FAB.

No Schedule tab until calendar exists.

The current header links on `/` (Add / Export / Import) go away. Export and Import live
only under Settings.

## Home

Client-derived. The server loads items; the device’s local calendar provides `today`.
Netlify is UTC, so aggregating in a Server Component would shift month boundaries and stale
age. Extract `localToday()` from `ItemForm` into a shared helper (e.g. `src/lib/dates.ts`)
and use it here, in Inventory filters, and in the form.

Period control in the header: the current month name (e.g. August) and **All-time**.
Default is this month. Persist the choice on the URL as `/?period=all` so refresh keeps it.
This control changes only:

| Surface | This month | All-time |
|---|---|---|
| Profit card | Revenue of items whose `soldDate` is in the current local calendar month, minus those items’ purchase prices. Subtitle: revenue, margin (`profit / revenue`, or hidden when revenue is 0), sold count | Same formula over every sold item |
| Sales strip | Three most recently sold this month (`soldDate` desc, then `id` desc) | Three most recently sold ever |

Stock cards never follow the toggle.

### Cards

All four cards are links. Money uses the existing list formatter (USD, `style: "currency"`).

| Card | Value | Subtitle | Href |
|---|---|---|---|
| Sales profit | `sum(sellingPrice) − sum(purchasePrice)` over the period’s sold items. Prefix `+` when ≥ 0 | Revenue, margin, sold count | `/inventory?filter=sold-month` or `filter=sold` when All-time |
| On the shelf | `sum(purchasePrice)` where `soldDate` is null (equals all-time `totalSpent − COGS`) | Unsold count | `/inventory?filter=unsold` |
| Posted, waiting | Count with `postedDate` set and `soldDate` null (status `POSTED`) | “listed, not sold” | `/inventory?filter=posted` |
| Stale | Count unsold where whole days from `purchaseDate` to `today` **> 60**. A purchase made 60 days ago is not stale; 61 days ago is | “> 60 days” | `/inventory?filter=stale` |

Days sitting and month membership use calendar dates, not timestamps: `ymd` strings
`YYYY-MM-DD`, same as the `date` columns. `daysSitting` is the difference in calendar
days between those two YMD values (implement as UTC midnight of each date so a local
timezone offset cannot move the day count). “This month” means `soldDate` has the same
`YYYY-MM` prefix as `today`.

### Oldest on the shelf

Up to three unsold items, oldest `purchaseDate` first (then `id` ascending). Each row:
photo, title, days sitting, amount paid, a stale chip if that item meets the stale rule.
Tap a row to `/items/[id]`. “See all” → `/inventory?filter=unsold&sort=oldest`.

If there are no unsold items, omit the section (do not show an empty list).

### Sales strip

Up to three sold items as defined by the period. Each row: photo, title, sold price,
profit. Tap to edit. “See all” uses the same href as the profit card.

If there are no sales in the current period, omit the section.

### Empty inventory

When `listItems()` returns no rows, show zeros on the cards, omit both strips, and a
sentence with links to add an item or import a backup. Do not invent placeholder items.

## Inventory

`/inventory` is the working list. Heading reflects the active filter, including a count
(`Stale · 41`).

### URL

| Param | Values | Default |
|---|---|---|
| `filter` | `all` · `in-stock` · `scheduled` · `posted` · `sold` · `sold-month` · `unsold` · `stale` | `all` |
| `sort` | `newest` (by `createdAt` desc, today’s list) · `oldest` (by `purchaseDate` asc, then `id` asc) | `newest` |
| `q` | Title substring, case-insensitive. Combined with the filter with AND | (none) |

`sort=oldest` is legal on any filter; Home’s “See all” on the oldest strip always sends
`filter=unsold&sort=oldest`.

Chip row, always visible, writing `filter` as:
**All** `all` · **In stock** `in-stock` (status `INVENTORY`) · **Scheduled** `scheduled` ·
**Posted** `posted` · **Sold** `sold` · **Unsold** `unsold` · **Stale** `stale`.
There is no extra “this month” chip. When `filter=sold-month`, the Sold chip is selected
and the heading says “Sold this month”; tapping Sold switches to `filter=sold`.

Search is one box bound to `q`. Clearing search or picking All writes the URL so share
and back-button behave.

Rows stay the current card (photo, title, paid, profit if sold, status badge) and open
`/items/[id]`. No swipe actions.

Zero matches: “No items match” plus a control that clears `q` and `filter`.

## Settings hub

`/settings` is a short list of links:

- Export data → `/settings/export`
- Import data → `/settings/import`

The hub has the tab bar. Export and import pages keep their existing headers (they already
link back) and do not gain tabs, so the import wizard is not crowded.

No theme, language, or category/site management in this increment.

## Construction

No schema changes. No new API routes. Existing CRUD, photo, mark-as-sold, export, and
import are untouched except the post-save redirect to `/inventory`.

Pure functions in `src/lib/inventoryStats.ts` (next to `itemStatus.ts`):

- `statsFor(items, today: YYYY-MM-DD)` → this-month and all-time profit/revenue/margin/sold
  count, shelf value, unsold count, posted-waiting count, stale count
- `filterItems(items, { filter, sort, q, today })` → the visible list
- `daysSitting(purchaseDate, today)` → integer whole days

`listItems()` already degrades to unconfigured / error / ok. Home and Inventory reuse
those three states. Do not add a second items loader.

Pages:

- `/` server-loads items, renders a client `HomeDashboard`
- `/inventory` server-loads items, renders a client `InventoryList` that reads the URL
- `/settings` is a static authenticated page of links

Tab bar padding includes `env(safe-area-inset-bottom)` so it clears the home indicator.
Keep the existing burgundy/cream palette and `prefers-color-scheme` dark variables.

## Testing

Unit tests only, Vitest, same style as `tests/unit/itemStatus.test.ts`. No new PGlite
cases and no deploy checklist — nothing here depends on Netlify Blobs.

- Empty list → zeros, empty oldest/sold arrays
- This-month profit ignores a sale whose `soldDate` is in a different month
- All-time profit = total revenue − COGS of every sold item
- On the shelf = sum of unsold purchase prices, and equals totalSpent − COGS
- Posted-waiting = `postedDate` set and not sold; a sold item with a leftover posted date
  does not count
- Stale: 61 days before `today` counts; exactly 60 days does not; sold items never count
- `filterItems` for `unsold`, `posted`, `stale`, `sold-month`, `sold`, `in-stock`,
  `scheduled`; title `q` ANDed with a filter
- `sort=oldest` orders by `purchaseDate` ascending
- Month boundary: `today = 2026-03-01` does not include a `soldDate` of `2026-02-28` in
  this-month

## Risks

- Computing month and stale age on the server would be silently wrong around midnight UTC
  and on the first/last day of the month. Mitigation: derive only in client code (and in
  tests that pass an explicit `today`).
- Redirecting the item form to `/inventory` is a small behavior change from today’s `/`.
  Mitigation: `/` is Home; the list the user was editing lives at `/inventory`.
