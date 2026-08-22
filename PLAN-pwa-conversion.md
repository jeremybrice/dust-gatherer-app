# PWA Conversion — Implementation Plan

## Overview

Replace the native Android app with an installable, OS-agnostic PWA hosted on Netlify,
backed by Netlify DB (Neon Postgres), gated by a single passphrase held in a Netlify
environment variable.

The existing Android app stays in the repo and buildable until migration is complete —
it is the only way to produce the export ZIP that seeds the new database.

## Decisions

| Question | Decision | Consequence |
|---|---|---|
| Offline support | **Installable only** — not offline-first | Server is the single source of truth. No IndexedDB, no sync queue, no tombstones. |
| Platform | **PWA replaces Android**, must be OS-agnostic | iOS Safari is a first-class target, not an afterthought. |
| Users | **Single user, always** | One passphrase in env. No user table, no per-row ownership, no data scoping. |
| Existing data | **Must migrate** | Android export ZIP (v2) is the migration path, and stays supported permanently. |

## Reference: product-almanac

`jeremybrice/product-almanac` is the reference for the *platform* stack only —
it is **not** a PWA (no manifest, no service worker) and has **no blob storage**.

Patterns we copy:

- Next.js 15 + `@netlify/plugin-nextjs`; `netlify.toml` pins the build and lets the
  plugin own the publish directory (never set `[build].publish`)
- `drizzle-orm/netlify-db` with a lazy module-scope client (constructed once, reused
  across invocations — never per request, which exhausts the connection limit)
- Migrations in `netlify/database/migrations`, applied via `netlify database migrations apply`
- `timingSafeEqual` passphrase comparison
- **Security headers belong in `middleware.ts`, not `netlify.toml`** — Netlify applies
  config headers *after* middleware, so `netlify.toml` headers would win and mask ours
- `fflate` for ZIP handling

Patterns we deliberately do **not** copy:

- `next-auth` + Upstash Redis + role generations + OAuth/MCP. That system exists to
  serve three rotating roles and machine clients. For one user with one passphrase it
  is ~80 lines of `jose` instead.

---

## Repository Layout

The Next.js app goes in `web/`, with `base = "web"` in `netlify.toml`.

Rationale: the Android app must stay buildable throughout migration (it produces the
export ZIP). A subdirectory keeps `build.gradle.kts` / `app/` untouched and lets us
delete them in one clean commit once the data is moved.

```
web/
  src/app/          Next.js App Router
  src/lib/          db, auth, schema, domain logic
  src/components/
  public/           manifest.webmanifest, sw.js, icons
  netlify/database/migrations/
netlify.toml        (repo root, base = "web")
app/                Android — deleted after migration
```

---

## Step 1: Database Schema

**File:** `web/src/lib/schema.ts`

A 1:1 port of the three Room entities.

**Keep `bigint` identity IDs.** With no offline record creation, there is no need for
client-generated UUIDs — and the export format (`ExportInventoryItem.id: Long`) is
numeric, so integer IDs preserve round-trip compatibility with existing backups.

```ts
export const inventoryItems = pgTable("inventory_items", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
  purchaseDate: date("purchase_date").notNull(),
  scheduledPostDate: date("scheduled_post_date"),
  postedDate: date("posted_date"),
  soldDate: date("sold_date"),
  imageKey: text("image_key"),              // was imagePath — now a Netlify Blobs key
  purchaseLocation: text("purchase_location").notNull().default(""),
  category: text("category").notNull().default(""),
  site: text("site").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("inventory_scheduled_idx").on(t.scheduledPostDate),
  index("inventory_sold_idx").on(t.soldDate),
  index("inventory_posted_idx").on(t.postedDate),
  index("inventory_created_idx").on(t.createdAt),
]);

export const categories = pgTable("categories", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

export const sites = pgTable("sites", { /* same shape as categories */ });
```

Three notes on the port:

1. **Money is `numeric(10,2)`, not `double precision`.** Room used `Double`; float
   money accumulates drift across the analytics SUMs. Drizzle returns `numeric` as a
   string — convert at the repository boundary, once.
2. **`purchaseDate` and friends are `date`, not `timestamptz`.** They are `LocalDate`
   in Kotlin — calendar days with no timezone. Storing them as instants would shift
   dates across timezone boundaries.
3. **`status` and `profit` stay derived.** They are computed properties on
   `InventoryItem`, not columns. Keep them computed in TypeScript; storing them
   invites drift between the dates and the status.

The indexes mirror the DAO's actual query shapes (`getItemsScheduledBetween`,
`getSoldItems`, `getPostedItems`, `getAllItems ORDER BY createdAt DESC`).

---

## Step 2: Authentication

**Files:** `web/src/lib/auth.ts`, `web/src/middleware.ts`, `web/src/app/login/page.tsx`,
`web/src/app/api/login/route.ts`

| Env var | Purpose |
|---|---|
| `DUST_GATHERER_PASSPHRASE` | The single credential. Server-only — never `NEXT_PUBLIC_`. |
| `SESSION_SECRET` | JWT signing key. Rotating it invalidates every outstanding session. |

Flow:

1. `POST /api/login` compares the submitted passphrase with `timingSafeEqual`
2. On success, sign an HS256 JWT with `jose` and set it as
   `httpOnly; Secure; SameSite=Lax; Max-Age=90d`
3. `middleware.ts` gates everything except `/login`, `/api/login`, and the PWA assets
   (`/manifest.webmanifest`, `/sw.js`, `/icons/*`) — these must stay public or the
   service worker cannot register and the app will not be installable
4. Refresh the cookie on activity so an installed app does not log itself out

Two hardening points:

- **Rate-limit the login.** A single passphrase on a public URL is brute-forceable.
  Almanac uses Redis; here a `login_attempts` table keyed on an IP hash is enough and
  avoids adding a second vendor.
- **90-day session, deliberately.** An installed PWA that demands a passphrase weekly
  is unusable in a thrift store. Cookie rotation via `SESSION_SECRET` is the revocation
  mechanism.

---

## Step 3: Images

The Android app captured via camera/gallery into a `FileProvider` path. The web
equivalent:

```html
<input type="file" accept="image/*" capture="environment">
```

This opens the camera directly on both Android and iOS with **no permission prompt** —
strictly simpler than the `CAMERA` / `READ_MEDIA_IMAGES` permissions the manifest
currently declares.

Storage is **Netlify Blobs** (`@netlify/blobs`): native to the platform, no extra
vendor, no separate bill.

| Route | Behavior |
|---|---|
| `POST /api/images` | Accepts a downscaled JPEG, writes to Blobs, returns the key |
| `GET /api/images/[key]` | Session-gated read, `Cache-Control: immutable` |

**Downscale client-side on a canvas before upload** — 1600px longest edge, JPEG q0.82.
Phone photos are 3–8MB; Netlify functions cap request bodies at roughly 6MB, so
uploading originals would fail outright on some photos. Downscaling keeps every upload
around 200–400KB and makes the app usable on thrift-store LTE. Never send the original.

---

## Step 4: PWA Shell

**Files:** `web/public/manifest.webmanifest`, `web/public/sw.js`, `web/src/app/layout.tsx`

Manifest: `display: standalone`, `start_url: /`, theme color `#722F37` (Burgundy) and
background `#FAF7F2` (Cream) from `ui/theme/Color.kt`. Icons at 192/512 plus a maskable
variant, generated from the existing `ic_launcher-playstore.png`.

**A service worker is required even though we are not offline-first** — Chrome's
install criteria demand a registered SW with a `fetch` handler. Ours is minimal:

- Precache the app shell and static assets
- **Network-first for HTML**, with an `/offline` fallback page
- Cache-first for `/api/images/*` (immutable by key)
- **Never cache authenticated HTML or API JSON** — a stale cached page after logout
  would leak inventory data

iOS specifics, now that iOS is a real target:

- `apple-touch-icon` link tag — iOS ignores manifest icons
- No `beforeinstallprompt` on iOS, so Settings needs an explicit
  "Add to Home Screen" walkthrough
- `env(safe-area-inset-*)` padding for notched devices
- iOS evicts PWA storage after ~7 days unused — irrelevant here, because the server
  holds the data. This is a genuine upside of the installable-only decision.

---

## Step 5: Data Migration (Android → PWA)

The requirement: export the current local Android database and reimport it into the new app.

The export format already exists and is versioned — `DataExporter.exportToZip` writes:

```
inventory.json     ExportData { manifest, items[], categories[], sites[] }
images/<filename>  one file per item with an image
```

`ExportModels.kt` is therefore the schema contract, and the manifest is at
`CURRENT_EXPORT_VERSION = 2`.

**Unzip in the browser, not in a function.** A ZIP containing dozens of photos will
exceed the function request-body limit. Doing it client-side sidesteps that entirely:

1. Settings → Import, user picks the `.zip` exported from the Android app
2. Browser unzips with `fflate`, parses `inventory.json`, rejects
   `manifest.version > 2` with the same message the Android importer uses
3. Preview shows item / category / site counts before committing
4. Each image is downscaled and uploaded individually to `/api/images`, with a
   progress bar — mirroring `onProgress` in the Kotlin importer
5. Items are POSTed to `/api/import` in batches of 50, with `imageFileName` replaced
   by the returned blob key
6. Conflict strategy matched **by `id`**, porting `DataImporter.kt` exactly:
   `SKIP_EXISTING`, `REPLACE_EXISTING`, `IMPORT_AS_NEW`

**Export stays in the PWA and emits the identical v2 ZIP.** That keeps backups
round-trippable, makes the migration reversible, and means import is a permanent
feature rather than a one-time script.

---

## Step 6: Screen Parity

| Android | Web | Notes |
|---|---|---|
| `InventoryScreen` | `/` | Search + status filter; DAO `searchItems` becomes an SQL `ILIKE` |
| `SwipeableItemCard` | pointer events | Swipe right → posted, left → sold. No native dependency. |
| `ItemDetailScreen` (648 LOC) | `/items/[id]` | The bulk of the work — full CRUD, image capture, date pickers, `MarkAsSoldDialog` |
| `CalendarScreen` | `/calendar` | Month grid over `getItemsScheduledBetween` |
| `AnalyticsScreen` | `/analytics` | Port the **current** COGS behavior: `inventoryValue = totalSpent - COGS`, `salesProfit = totalRevenue - COGS` (the PLAN.md redesign is already live) |
| `SettingsScreen` | `/settings` | Theme, language, import/export, iOS install instructions |
| `CategoryManagementScreen` / `SiteManagementScreen` | `/settings/categories`, `/settings/sites` | Straight CRUD |

Theme: `Color.kt` values become CSS custom properties. System/light/dark maps to
`prefers-color-scheme` plus an explicit override, persisted server-side rather than in
DataStore.

I18n: 110 strings in EN and UK. A build script converts `strings.xml` and
`values-uk/strings.xml` into `en.json` / `uk.json`; a small dictionary provider replaces
`stringResource`. `next-intl` is more machinery than one user and two languages needs.

---

## Step 7: Decommission Android

Only after the import has been verified against real data:

- Delete `app/`, `build.gradle.kts`, `settings.gradle.kts`, `gradle/`, `gradlew*`
- Rewrite `README.md` for the web stack
- Move `web/` contents to the repo root and drop `base` from `netlify.toml`

---

## Environment Variables

| Variable | Set by | Purpose |
|---|---|---|
| `NETLIFY_DB_URL` | Netlify (auto) | Neon Postgres connection |
| `DUST_GATHERER_PASSPHRASE` | Manual | The single login credential |
| `SESSION_SECRET` | Manual | JWT signing key |

Claim the auto-provisioned Netlify DB to a Neon account so it is not left as a trial
instance.

---

## Out of Scope

- **Bulk select** (`PLAN-bulk-select.md`) — the plan is merged but the feature was never
  implemented in the Android app, so it is not parity work. The plan ports cleanly to
  the web once parity lands; long-press becomes long-press-or-checkbox.
- Multi-user, sharing, roles — explicitly ruled out.
- Full offline support — ruled out. If thrift-store connectivity proves painful in
  practice, the escape hatch is adding IndexedDB write-behind later; the schema does not
  block it, though client-generated IDs would need revisiting at that point.

---

## Build Order

1. Scaffold `web/`, `netlify.toml`, Netlify DB + Drizzle schema, passphrase auth —
   vertical slice: log in, see an empty item list
2. Inventory list + Item Detail CRUD with image capture — the bulk of the work
3. Calendar, Analytics, Settings, category/site management
4. PWA layer: manifest, icons, service worker, install flow, iOS instructions
5. Import/export: ZIP round-trip, then migrate the real database
6. I18n pass (EN/UK)
7. Decommission Android
