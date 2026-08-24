# Home Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unfiltered inventory homepage with a command-center snapshot (this-month profit, shelf cash, movement) that taps through to a searchable, filterable `/inventory` list.

**Architecture:** `listItems()` stays the only loader. Pure functions in `src/lib/dates.ts` and `src/lib/inventoryStats.ts` derive every card, strip, and filtered list from those rows plus an explicit `today` (`YYYY-MM-DD`). Server pages load items; client components call `localToday()` so Netlify UTC cannot shift month boundaries or stale age. Bottom `AppShell` tabs wrap Home, Inventory, and Settings only.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, existing Drizzle `listItems()`, Vitest. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-24-home-command-center-design.md](../specs/2026-08-24-home-command-center-design.md)

## Deviations from the spec, decided during planning

1. **`daysSitting` lives in `src/lib/dates.ts`**, not `inventoryStats.ts`. It is calendar-day math (UTC midnight of two YMD strings) and belongs with `localToday`. `inventoryStats.ts` imports it.
2. **`createdAt` is added to `InventoryItemView` as an ISO string.** Needed so `filterItems` can honor `sort=newest` by `createdAt` desc after filtering. Not a migration — the column already exists; `toView` currently drops it.
3. **URL helpers (`parseFilter`, `parseSort`, `parsePeriod`, `inventoryHref`) live in `inventoryStats.ts`** next to `filterItems`, so Home cards and Inventory chips cannot drift from the functions the tests lock.

## Global Constraints

- No schema changes, no migrations, no new API routes. `listItems()` is the only items loader.
- `status` and `profit` stay derived in `src/lib/itemStatus.ts` and are never stored.
- `today` is always an explicit `YYYY-MM-DD` argument, or `localToday()` from the device calendar — never `new Date().toISOString().slice(0, 10)` and never server UTC.
- Stale means unsold and `daysSitting(purchaseDate, today) > 60`. Exactly 60 is not stale. Sold items are never stale. The threshold is the constant `STALE_AFTER_DAYS = 60`, not a setting.
- “This month” means `soldDate` shares the `YYYY-MM` prefix of `today`.
- Unit tests only (Vitest). No new PGlite cases, no Blobs, no deploy checklist.
- `AppShell` tabs on Home, Inventory, and Settings only. Item create/edit, export, and import do not get tabs. No FAB.
- After save, mark-as-sold, delete, and Cancel, the item form goes to `/inventory`.
- Existing burgundy/cream CSS variables and `prefers-color-scheme` dark mode stay. No new dependencies.
- Do not touch `src/middleware.ts`. Deploy only by pushing to `main`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/dates.ts` (create) | `localToday`, `daysSitting`, `sameMonth`, `monthLabel` |
| `src/lib/inventoryStats.ts` (create) | `statsFor`, `filterItems`, URL parse/href helpers, `STALE_AFTER_DAYS` |
| `src/lib/money.ts` (create) | `formatMoney` — the list page’s USD formatter, one place |
| `src/lib/items.ts` (modify) | Add `createdAt: string` on `InventoryItemView` |
| `src/components/AppShell.tsx` (create) | Header, optional + Add, bottom tabs |
| `src/components/HomeDashboard.tsx` (create) | Client snapshot: cards + oldest + recent sales |
| `src/components/InventoryList.tsx` (create) | Client search, chips, filtered rows |
| `src/app/page.tsx` (modify) | Home loader |
| `src/app/inventory/page.tsx` (create) | Inventory loader |
| `src/app/settings/page.tsx` (create) | Hub linking export/import |
| `src/app/globals.css` (modify) | Tab bar, stat cards, chips, strips |
| `src/components/ItemForm.tsx` (modify) | Import `localToday`; redirect/Cancel to `/inventory` |
| `src/components/ExportPanel.tsx` (modify) | Back → `/settings` |
| `src/components/ImportWizard.tsx` (modify) | Back → `/settings`; success → `/inventory` |
| `tests/unit/dates.test.ts` (create) | Calendar-day helpers |
| `tests/unit/inventoryStats.test.ts` (create) | Stats, filters, URL helpers |
| `docs/handoff.md` (modify) | Current-state list |

---

### Task 1: Date helpers

**Files:**
- Create: `src/lib/dates.ts`
- Create: `tests/unit/dates.test.ts`
- Modify: `src/components/ItemForm.tsx` (replace the inline `localToday` with an import; leave redirects pointing at `/` until Task 8)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `localToday(): string` — device calendar `YYYY-MM-DD`
  - `daysSitting(purchaseDate: string, today: string): number` — whole calendar days between two YMD strings, computed as UTC midnight of each so a local offset cannot move the count
  - `sameMonth(ymd: string, today: string): boolean` — `ymd.slice(0, 7) === today.slice(0, 7)`
  - `monthLabel(today: string): string` — English month name of `today` (e.g. `"August"`), via `Date.UTC` + `toLocaleString("en-US", { month: "long", timeZone: "UTC" })`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { daysSitting, localToday, monthLabel, sameMonth } from "@/lib/dates";

describe("localToday", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("daysSitting", () => {
  it("is the calendar-day difference via UTC midnight", () => {
    expect(daysSitting("2026-08-24", "2026-08-24")).toBe(0);
    expect(daysSitting("2026-06-25", "2026-08-24")).toBe(60);
    expect(daysSitting("2026-06-24", "2026-08-24")).toBe(61);
  });
});

describe("sameMonth", () => {
  it("matches on YYYY-MM, not the day", () => {
    expect(sameMonth("2026-08-01", "2026-08-24")).toBe(true);
    expect(sameMonth("2026-02-28", "2026-03-01")).toBe(false);
  });
});

describe("monthLabel", () => {
  it("names the month in English from the YMD", () => {
    expect(monthLabel("2026-08-24")).toBe("August");
    expect(monthLabel("2026-03-01")).toBe("March");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/dates.test.ts`

Expected: FAIL with `Cannot find module '@/lib/dates'` (or `localToday is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/dates.ts`:

```ts
/** The DEVICE's calendar date. `new Date().toISOString()` is UTC and
 *  would shift the day for an evening entry. */
export function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Whole calendar days from `purchaseDate` to `today`. Both are `YYYY-MM-DD`.
 *  Parsed as UTC midnight so the browser timezone cannot move the count. */
export function daysSitting(purchaseDate: string, today: string): number {
  const [py, pm, pd] = purchaseDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const a = Date.UTC(py, pm - 1, pd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

export function sameMonth(ymd: string, today: string): boolean {
  return ymd.slice(0, 7) === today.slice(0, 7);
}

export function monthLabel(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}
```

In `src/components/ItemForm.tsx`, delete the local `localToday` function (the comment plus the five-line body) and add:

```ts
import { localToday } from "@/lib/dates";
```

Keep `router.push("/")` and Cancel `href="/"` unchanged in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dates.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/unit/dates.test.ts src/components/ItemForm.tsx
git commit -m "Extract localToday and calendar-day helpers"
```

---

### Task 2: `statsFor`

**Files:**
- Create: `src/lib/inventoryStats.ts`
- Create: `tests/unit/inventoryStats.test.ts`

**Interfaces:**
- Consumes: `InventoryItemView` from `src/lib/items.ts` (still without `createdAt` — Task 3 adds that); `daysSitting` and `sameMonth` from Task 1; `deriveStatus` from `src/lib/itemStatus.ts`.
- Produces:
  - `STALE_AFTER_DAYS = 60`
  - `interface PeriodStats { revenue: number; profit: number; soldCount: number; margin: number | null }`
  - `interface InventoryStats { thisMonth: PeriodStats; allTime: PeriodStats; shelfValue: number; unsoldCount: number; postedWaiting: number; staleCount: number; oldestUnsold: InventoryItemView[]; soldThisMonth: InventoryItemView[]; soldAllTime: InventoryItemView[] }`
  - `statsFor(items: InventoryItemView[], today: string): InventoryStats`
  - Oldest arrays capped at 3. `oldestUnsold` sorted by `purchaseDate` asc, then `id` asc. Sold strips sorted by `soldDate` desc, then `id` desc.
  - `margin` is `profit / revenue`, or `null` when `revenue === 0`.
  - A sold item with `sellingPrice === null` contributes `0` to revenue.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/inventoryStats.test.ts`. The `view` helper derives `status`/`profit` so tests cannot disagree with `itemStatus.ts`.

```ts
import { describe, it, expect } from "vitest";
import { deriveProfit, deriveStatus } from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import { STALE_AFTER_DAYS, statsFor } from "@/lib/inventoryStats";

function view(
  over: Partial<InventoryItemView> & { id: number; title: string },
): InventoryItemView {
  const base: InventoryItemView = {
    description: "",
    purchasePrice: 10,
    sellingPrice: null,
    purchaseDate: "2026-01-01",
    scheduledPostDate: null,
    postedDate: null,
    soldDate: null,
    imageKey: null,
    purchaseLocation: "",
    category: "",
    site: "",
    notes: "",
    status: "INVENTORY",
    profit: null,
    ...over,
  };
  return {
    ...base,
    status: deriveStatus(base),
    profit: deriveProfit(base),
  };
}

const TODAY = "2026-08-24";

describe("statsFor", () => {
  it("returns zeros and empty strips for an empty list", () => {
    expect(statsFor([], TODAY)).toEqual({
      thisMonth: { revenue: 0, profit: 0, soldCount: 0, margin: null },
      allTime: { revenue: 0, profit: 0, soldCount: 0, margin: null },
      shelfValue: 0,
      unsoldCount: 0,
      postedWaiting: 0,
      staleCount: 0,
      oldestUnsold: [],
      soldThisMonth: [],
      soldAllTime: [],
    });
  });

  it("ignores a sale from another month in this-month profit", () => {
    const items = [
      view({
        id: 1, title: "aug", purchasePrice: 10, sellingPrice: 40,
        soldDate: "2026-08-10",
      }),
      view({
        id: 2, title: "jul", purchasePrice: 5, sellingPrice: 20,
        soldDate: "2026-07-31",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.thisMonth).toEqual({
      revenue: 40, profit: 30, soldCount: 1, margin: 30 / 40,
    });
    expect(s.allTime).toEqual({
      revenue: 60, profit: 45, soldCount: 2, margin: 45 / 60,
    });
  });

  it("treats on-the-shelf as unsold purchase sum, equal to totalSpent - COGS", () => {
    const items = [
      view({ id: 1, title: "kept", purchasePrice: 12, purchaseDate: "2026-08-01" }),
      view({
        id: 2, title: "sold", purchasePrice: 8, sellingPrice: 20,
        soldDate: "2026-08-10",
      }),
    ];
    const s = statsFor(items, TODAY);
    const totalSpent = 12 + 8;
    const cogs = 8;
    expect(s.shelfValue).toBe(12);
    expect(s.shelfValue).toBe(totalSpent - cogs);
    expect(s.unsoldCount).toBe(1);
  });

  it("counts posted-waiting only when posted and not sold", () => {
    const items = [
      view({ id: 1, title: "live", postedDate: "2026-08-01" }),
      view({
        id: 2, title: "sold leftover posted", postedDate: "2026-07-01",
        sellingPrice: 15, soldDate: "2026-08-02",
      }),
    ];
    expect(statsFor(items, TODAY).postedWaiting).toBe(1);
  });

  it("counts stale at 61 days, not 60, and never counts sold items", () => {
    expect(STALE_AFTER_DAYS).toBe(60);
    const items = [
      view({ id: 1, title: "61d", purchaseDate: "2026-06-24" }),
      view({ id: 2, title: "60d", purchaseDate: "2026-06-25" }),
      view({
        id: 3, title: "sold old", purchaseDate: "2026-01-01",
        sellingPrice: 20, soldDate: "2026-08-01",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.staleCount).toBe(1);
    expect(s.oldestUnsold.map((i) => i.title)).toEqual(["61d", "60d"]);
  });

  it("does not put a February sale into March this-month", () => {
    const items = [
      view({
        id: 1, title: "feb", purchasePrice: 10, sellingPrice: 25,
        soldDate: "2026-02-28",
      }),
    ];
    const s = statsFor(items, "2026-03-01");
    expect(s.thisMonth.soldCount).toBe(0);
    expect(s.thisMonth.revenue).toBe(0);
    expect(s.allTime.soldCount).toBe(1);
    expect(s.soldThisMonth).toEqual([]);
    expect(s.soldAllTime).toHaveLength(1);
  });

  it("caps strips at three and orders oldest / most-recently-sold", () => {
    const items = [
      view({ id: 1, title: "old-a", purchaseDate: "2026-01-01" }),
      view({ id: 2, title: "old-b", purchaseDate: "2026-02-01" }),
      view({ id: 3, title: "old-c", purchaseDate: "2026-03-01" }),
      view({ id: 4, title: "old-d", purchaseDate: "2026-04-01" }),
      view({
        id: 10, title: "sale-early", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-01",
      }),
      view({
        id: 11, title: "sale-mid", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-10",
      }),
      view({
        id: 12, title: "sale-late-low", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-20",
      }),
      view({
        id: 13, title: "sale-late-high", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-20",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.oldestUnsold.map((i) => i.title)).toEqual(["old-a", "old-b", "old-c"]);
    expect(s.soldThisMonth.map((i) => i.title)).toEqual([
      "sale-late-high", "sale-late-low", "sale-mid",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/inventoryStats.test.ts`

Expected: FAIL — `Cannot find module '@/lib/inventoryStats'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/inventoryStats.ts`:

```ts
import { daysSitting, sameMonth } from "@/lib/dates";
import type { InventoryItemView } from "@/lib/items";
import { deriveStatus } from "@/lib/itemStatus";

export const STALE_AFTER_DAYS = 60;

export interface PeriodStats {
  revenue: number;
  profit: number;
  soldCount: number;
  margin: number | null;
}

export interface InventoryStats {
  thisMonth: PeriodStats;
  allTime: PeriodStats;
  shelfValue: number;
  unsoldCount: number;
  postedWaiting: number;
  staleCount: number;
  oldestUnsold: InventoryItemView[];
  soldThisMonth: InventoryItemView[];
  soldAllTime: InventoryItemView[];
}

function isSold(item: InventoryItemView): boolean {
  return item.soldDate != null;
}

export function isStale(item: InventoryItemView, today: string): boolean {
  if (isSold(item)) return false;
  return daysSitting(item.purchaseDate, today) > STALE_AFTER_DAYS;
}

function periodStats(sold: InventoryItemView[]): PeriodStats {
  let revenue = 0;
  let cogs = 0;
  for (const item of sold) {
    revenue += item.sellingPrice ?? 0;
    cogs += item.purchasePrice;
  }
  const profit = revenue - cogs;
  return {
    revenue,
    profit,
    soldCount: sold.length,
    margin: revenue === 0 ? null : profit / revenue,
  };
}

function byOldest(a: InventoryItemView, b: InventoryItemView): number {
  if (a.purchaseDate !== b.purchaseDate) {
    return a.purchaseDate < b.purchaseDate ? -1 : 1;
  }
  return a.id - b.id;
}

function bySoldRecent(a: InventoryItemView, b: InventoryItemView): number {
  const ad = a.soldDate ?? "";
  const bd = b.soldDate ?? "";
  if (ad !== bd) return ad < bd ? 1 : -1;
  return b.id - a.id;
}

export function statsFor(items: InventoryItemView[], today: string): InventoryStats {
  const unsold = items.filter((i) => !isSold(i));
  const sold = items.filter(isSold);
  const soldThisMonth = sold.filter((i) => sameMonth(i.soldDate!, today));
  return {
    thisMonth: periodStats(soldThisMonth),
    allTime: periodStats(sold),
    shelfValue: unsold.reduce((sum, i) => sum + i.purchasePrice, 0),
    unsoldCount: unsold.length,
    postedWaiting: items.filter((i) => deriveStatus(i) === "POSTED").length,
    staleCount: unsold.filter((i) => isStale(i, today)).length,
    oldestUnsold: [...unsold].sort(byOldest).slice(0, 3),
    soldThisMonth: [...soldThisMonth].sort(bySoldRecent).slice(0, 3),
    soldAllTime: [...sold].sort(bySoldRecent).slice(0, 3),
  };
}
```

`isStale` is a named export so Task 3’s `filterItems` uses the same rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/inventoryStats.test.ts tests/unit/dates.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventoryStats.ts tests/unit/inventoryStats.test.ts
git commit -m "Add inventory snapshot stats"
```

---

### Task 3: `filterItems`, URL helpers, and `createdAt`

**Files:**
- Modify: `src/lib/inventoryStats.ts`
- Modify: `src/lib/items.ts` — add `createdAt: string` to `InventoryItemView` and map `row.createdAt.toISOString()` in `toView`
- Modify: `tests/unit/inventoryStats.test.ts` — give `view()` a default `createdAt` and append the tests below

**Interfaces:**
- Consumes: `statsFor` / `isStale` from Task 2; `deriveStatus`; `sameMonth`.
- Produces:
  - `export type InventoryFilter = "all" | "in-stock" | "scheduled" | "posted" | "sold" | "sold-month" | "unsold" | "stale"`
  - `export type InventorySort = "newest" | "oldest"`
  - `export type HomePeriod = "month" | "all"`
  - `filterItems(items: InventoryItemView[], opts: { filter: InventoryFilter; sort: InventorySort; q: string; today: string }): InventoryItemView[]`
  - `parseFilter(raw: string | null | undefined): InventoryFilter` — unknown → `"all"`
  - `parseSort(raw: string | null | undefined): InventorySort` — unknown → `"newest"`
  - `parsePeriod(raw: string | null | undefined): HomePeriod` — `"all"` else `"month"`
  - `inventoryHref(opts: { filter?: InventoryFilter; sort?: InventorySort; q?: string }): string` — omits default params; empty → `"/inventory"`
  - `FILTER_LABELS: Record<InventoryFilter, string>`:
    `all: "All items"`, `in-stock: "In stock"`, `scheduled: "Scheduled"`, `posted: "Posted"`, `sold: "Sold"`, `sold-month: "Sold this month"`, `unsold: "On the shelf"`, `stale: "Stale"`
  - `q` matches `title` case-insensitively as a substring, ANDed with the filter.
  - `sort=newest` → `createdAt` desc, then `id` desc. `sort=oldest` → `purchaseDate` asc, then `id` asc.

- [ ] **Step 1: Write the failing tests**

In the existing `view()` helper, add `createdAt: "2026-08-01T00:00:00.000Z"` to the default `base` object (before `...over`) so every existing test still type-checks once `createdAt` is required.

Extend the existing `@/lib/inventoryStats` import with `FILTER_LABELS`, `filterItems`, `inventoryHref`, `parseFilter`, `parsePeriod`, `parseSort`, and `type InventoryFilter`. Then append:

describe("parse helpers", () => {
  it("defaults unknown filter/sort/period", () => {
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter("nope")).toBe("all");
    expect(parseFilter("stale")).toBe("stale");
    expect(parseSort(undefined)).toBe("newest");
    expect(parseSort("oldest")).toBe("oldest");
    expect(parsePeriod(undefined)).toBe("month");
    expect(parsePeriod("all")).toBe("all");
  });
});

describe("inventoryHref", () => {
  it("omits default query params", () => {
    expect(inventoryHref({})).toBe("/inventory");
    expect(inventoryHref({ filter: "all", sort: "newest" })).toBe("/inventory");
    expect(inventoryHref({ filter: "stale" })).toBe("/inventory?filter=stale");
    expect(inventoryHref({ filter: "unsold", sort: "oldest" })).toBe(
      "/inventory?filter=unsold&sort=oldest",
    );
    expect(inventoryHref({ q: "bowl" })).toBe("/inventory?q=bowl");
  });
});

describe("filterItems", () => {
  const items = [
    view({ id: 1, title: "Pyrex bowl", purchaseDate: "2026-01-01", createdAt: "2026-08-20T00:00:00.000Z" }),
    view({ id: 2, title: "Wool coat", postedDate: "2026-08-01", purchaseDate: "2026-06-01", createdAt: "2026-08-19T00:00:00.000Z" }),
    view({
      id: 3, title: "Jadeite mug", purchasePrice: 5, sellingPrice: 28,
      soldDate: "2026-08-12", purchaseDate: "2026-07-01",
      createdAt: "2026-08-18T00:00:00.000Z",
    }),
    view({
      id: 4, title: "Brass lamp", scheduledPostDate: "2026-08-30",
      purchaseDate: "2026-06-24", createdAt: "2026-08-17T00:00:00.000Z",
    }),
    view({
      id: 5, title: "July sale", purchasePrice: 4, sellingPrice: 10,
      soldDate: "2026-07-04", createdAt: "2026-07-04T00:00:00.000Z",
    }),
  ];

  const opts = (filter: InventoryFilter, extra: { sort?: "newest" | "oldest"; q?: string } = {}) =>
    ({ filter, sort: extra.sort ?? "newest", q: extra.q ?? "", today: TODAY });

  it("filters each named set", () => {
    expect(filterItems(items, opts("unsold")).map((i) => i.id).sort()).toEqual([1, 2, 4]);
    expect(filterItems(items, opts("posted")).map((i) => i.id)).toEqual([2]);
    expect(filterItems(items, opts("stale")).map((i) => i.id).sort()).toEqual([1, 2, 4]);
    expect(filterItems(items, opts("sold-month")).map((i) => i.id)).toEqual([3]);
    expect(filterItems(items, opts("sold")).map((i) => i.id).sort()).toEqual([3, 5]);
    expect(filterItems(items, opts("in-stock")).map((i) => i.id)).toEqual([1]);
    expect(filterItems(items, opts("scheduled")).map((i) => i.id)).toEqual([4]);
  });

  it("ANDs a case-insensitive title substring with the filter", () => {
    expect(filterItems(items, opts("unsold", { q: "WOOL" })).map((i) => i.id)).toEqual([2]);
    expect(filterItems(items, opts("unsold", { q: "nope" }))).toEqual([]);
  });

  it("sorts oldest by purchaseDate then id", () => {
    expect(
      filterItems(items, opts("unsold", { sort: "oldest" })).map((i) => i.title),
    ).toEqual(["Pyrex bowl", "Wool coat", "Brass lamp"]);
  });

  it("sorts newest by createdAt then id", () => {
    expect(
      filterItems(items, opts("all", { sort: "newest" })).map((i) => i.id),
    ).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("FILTER_LABELS", () => {
  it("names sold-month distinctly", () => {
    expect(FILTER_LABELS["sold-month"]).toBe("Sold this month");
    expect(FILTER_LABELS.stale).toBe("Stale");
  });
});
```

Stale assertion: items 1 (`2026-01-01`), 2 (`2026-06-01`), and 4 (`2026-06-24`) are all > 60 days before `2026-08-24`. Keep that.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/inventoryStats.test.ts`

Expected: FAIL — `filterItems is not a function` and/or type error on `createdAt`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/items.ts`, add `createdAt: string` to `InventoryItemView` (after `notes`) and in `toView`:

```ts
createdAt: row.createdAt.toISOString(),
```

Append to `src/lib/inventoryStats.ts`:

```ts
export type InventoryFilter =
  | "all"
  | "in-stock"
  | "scheduled"
  | "posted"
  | "sold"
  | "sold-month"
  | "unsold"
  | "stale";

export type InventorySort = "newest" | "oldest";
export type HomePeriod = "month" | "all";

const FILTERS: InventoryFilter[] = [
  "all", "in-stock", "scheduled", "posted", "sold", "sold-month", "unsold", "stale",
];

export const FILTER_LABELS: Record<InventoryFilter, string> = {
  all: "All items",
  "in-stock": "In stock",
  scheduled: "Scheduled",
  posted: "Posted",
  sold: "Sold",
  "sold-month": "Sold this month",
  unsold: "On the shelf",
  stale: "Stale",
};

export function parseFilter(raw: string | null | undefined): InventoryFilter {
  return FILTERS.includes(raw as InventoryFilter) ? (raw as InventoryFilter) : "all";
}

export function parseSort(raw: string | null | undefined): InventorySort {
  return raw === "oldest" ? "oldest" : "newest";
}

export function parsePeriod(raw: string | null | undefined): HomePeriod {
  return raw === "all" ? "all" : "month";
}

export function inventoryHref(opts: {
  filter?: InventoryFilter;
  sort?: InventorySort;
  q?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.filter && opts.filter !== "all") p.set("filter", opts.filter);
  if (opts.sort && opts.sort !== "newest") p.set("sort", opts.sort);
  const q = opts.q?.trim() ?? "";
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/inventory?${s}` : "/inventory";
}

export function filterItems(
  items: InventoryItemView[],
  opts: { filter: InventoryFilter; sort: InventorySort; q: string; today: string },
): InventoryItemView[] {
  const needle = opts.q.trim().toLowerCase();
  const matched = items.filter((item) => {
    if (needle && !item.title.toLowerCase().includes(needle)) return false;
    switch (opts.filter) {
      case "all": return true;
      case "in-stock": return deriveStatus(item) === "INVENTORY";
      case "scheduled": return deriveStatus(item) === "SCHEDULED";
      case "posted": return deriveStatus(item) === "POSTED";
      case "sold": return item.soldDate != null;
      case "sold-month":
        return item.soldDate != null && sameMonth(item.soldDate, opts.today);
      case "unsold": return item.soldDate == null;
      case "stale": return isStale(item, opts.today);
    }
  });
  const sorted = [...matched];
  if (opts.sort === "oldest") {
    sorted.sort(byOldest);
  } else {
    sorted.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return b.id - a.id;
    });
  }
  return sorted;
}
```

`byOldest` is already in the file from Task 2. Do not duplicate it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/inventoryStats.test.ts tests/unit/dates.test.ts`

Expected: PASS.

Also run: `npx vitest run` (full suite) — `createdAt` on the view must not break CRUD/export tests. If a test constructs a raw view object, add `createdAt`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventoryStats.ts src/lib/items.ts tests/unit/inventoryStats.test.ts
git commit -m "Add inventory filters and list URL helpers"
```

---

### Task 4: AppShell, money formatter, and CSS

**Files:**
- Create: `src/components/AppShell.tsx`
- Create: `src/lib/money.ts`
- Modify: `src/app/globals.css` (append the block below; do not rewrite existing rules)

**Interfaces:**
- Consumes: nothing from Tasks 2–3 except later pages wrapping this shell.
- Produces:
  - `formatMoney(n: number): string` — `n.toLocaleString(undefined, { style: "currency", currency: "USD" })`
  - `AppShell({ title, active, addHref, children }: { title: string; active: "home" | "inventory" | "settings"; addHref?: string; children: React.ReactNode })`
  - Tabs: Home → `/`, Inventory → `/inventory`, Settings → `/settings`. Active tab gets class `on`.
  - When `addHref` is set, header nav is `<a href={addHref}>+ Add</a>`. Home and Inventory pass `addHref="/items/new"`. Settings omits it.

No unit tests in this task (no component test runner). The check is typecheck.

- [ ] **Step 1: Add `src/lib/money.ts`**

```ts
export function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
```

Replace the local `money` helpers in `src/app/page.tsx` and `src/components/ItemForm.tsx` with this import so every surface formats USD the same way. In ItemForm the identifier can stay `money` via `import { formatMoney as money } from "@/lib/money"` or switch call sites to `formatMoney`.

- [ ] **Step 2: Add `src/components/AppShell.tsx`**

```tsx
import type { ReactNode } from "react";

export default function AppShell({
  title,
  active,
  addHref,
  children,
}: {
  title: string;
  active: "home" | "inventory" | "settings";
  addHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="container shelled">
      <header className="app">
        <h1>{title}</h1>
        {addHref ? (
          <nav className="nav">
            <a href={addHref}>+ Add</a>
          </nav>
        ) : null}
      </header>
      {children}
      <nav className="tabbar" aria-label="Primary">
        <a href="/" className={active === "home" ? "on" : undefined}>Home</a>
        <a href="/inventory" className={active === "inventory" ? "on" : undefined}>Inventory</a>
        <a href="/settings" className={active === "settings" ? "on" : undefined}>Settings</a>
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Append CSS to `src/app/globals.css`**

```css
/* Command-center shell */
.shelled { padding-bottom: 5.5rem; }

.tabbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 0.5rem 0 env(safe-area-inset-bottom);
  z-index: 5;
}
.tabbar a {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.35rem 0;
}
.tabbar a.on { color: var(--burgundy); }

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.stat {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem;
}
.stat.wide { grid-column: 1 / -1; }
.stat .k {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat .v { font-size: 1.25rem; font-weight: 700; margin-top: 0.15rem; }
.stat .s { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
.stat.profit .v { color: var(--sage); }
.stat.warn .v { color: var(--burgundy); }

.period {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}
.period strong { font-size: 1rem; }
.period a { font-weight: 600; }

.strip-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 1.25rem 0 0.4rem;
}
.strip-head h2 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--burgundy);
  margin: 0;
}
.strip-head a { font-size: 0.8125rem; }

.chip {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f3e6e7;
  color: var(--burgundy);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.75rem;
}
.chips a {
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  background: var(--surface);
}
.chips a.on {
  color: #fff;
  background: var(--burgundy);
  border-color: var(--burgundy);
}

.search {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  margin-bottom: 0.75rem;
  font-family: inherit;
}

.settings-links { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
.settings-links a {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.9rem 1rem;
}
.settings-links h2 { font-size: 1rem; margin: 0 0 0.15rem; color: var(--burgundy); }
.settings-links p { margin: 0; font-size: 0.8125rem; color: var(--text-muted); }
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: PASS (ItemForm `money` rename must compile).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/components/AppShell.tsx src/app/globals.css src/components/ItemForm.tsx src/app/page.tsx
git commit -m "Add app shell, money helper, and command-center CSS"
```

`src/app/page.tsx` still lists items in this commit if you swapped `money` there. That is fine; Task 5 replaces the page body.

---

### Task 5: Home at `/`

**Files:**
- Create: `src/components/HomeDashboard.tsx`
- Modify: `src/app/page.tsx` — load items, wrap `HomeDashboard` in `AppShell`

**Interfaces:**
- Consumes: `statsFor`, `inventoryHref`, `parsePeriod`, `HomePeriod` from Task 3; `localToday`, `monthLabel` from Task 1; `formatMoney` from Task 4; `InventoryItemView`; `AppShell`.
- Produces: client `HomeDashboard({ items, period }: { items: InventoryItemView[]; period: HomePeriod })`.
  - Period toggle: current month name vs All-time. This-month view links to `/?period=all`; all-time view links to `/`.
  - Four cards are `<a className="stat">` with the hrefs from the spec.
  - Profit value: `n >= 0 ? \`+${formatMoney(n)}\` : formatMoney(n)`.
  - Margin subtitle omitted when `margin === null`; otherwise `Math.round(margin * 100) + "% margin"`.
  - Oldest strip omitted when `oldestUnsold.length === 0`. Each row links to `/items/${id}`. “See all” → `inventoryHref({ filter: "unsold", sort: "oldest" })`. Stale chip when `daysSitting(item.purchaseDate, today) > 60`.
  - Sales strip omitted when the period’s sold array is empty. “See all” uses the profit card href.
  - Empty `items`: still show zeroed cards (statsFor handles that), omit strips, plus: `No items yet. <a href="/items/new">Add your first item</a> or <a href="/settings/import">import a backup</a>.`
  - Unconfigured / error: keep the existing `.notice` copy from today’s `page.tsx`; still wrap in `AppShell`.

- [ ] **Step 1: Write `HomeDashboard`**

`src/components/HomeDashboard.tsx`:

```tsx
"use client";

import { daysSitting, localToday, monthLabel } from "@/lib/dates";
import {
  STALE_AFTER_DAYS,
  inventoryHref,
  statsFor,
  type HomePeriod,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

function profitText(n: number): string {
  return n >= 0 ? `+${formatMoney(n)}` : formatMoney(n);
}

export default function HomeDashboard({
  items,
  period,
}: {
  items: InventoryItemView[];
  period: HomePeriod;
}) {
  const today = localToday();
  const stats = statsFor(items, today);
  const flow = period === "all" ? stats.allTime : stats.thisMonth;
  const soldStrip = period === "all" ? stats.soldAllTime : stats.soldThisMonth;
  const soldHref = inventoryHref({
    filter: period === "all" ? "sold" : "sold-month",
  });
  const month = monthLabel(today);

  return (
    <>
      <div className="period">
        {period === "month" ? (
          <>
            <strong>{month}</strong>
            <a href="/?period=all">All-time →</a>
          </>
        ) : (
          <>
            <strong>All-time</strong>
            <a href="/">{month} →</a>
          </>
        )}
      </div>

      <div className="stats">
        <a className="stat profit wide" href={soldHref}>
          <div className="k">
            {period === "all" ? "Sales profit" : "Sales profit this month"}
          </div>
          <div className="v">{profitText(flow.profit)}</div>
          <div className="s">
            {formatMoney(flow.revenue)} revenue
            {flow.margin != null && <> · {Math.round(flow.margin * 100)}% margin</>}
            {" · "}{flow.soldCount} sold
          </div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "unsold" })}>
          <div className="k">On the shelf</div>
          <div className="v">{formatMoney(stats.shelfValue)}</div>
          <div className="s">{stats.unsoldCount} unsold</div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "posted" })}>
          <div className="k">Posted, waiting</div>
          <div className="v">{stats.postedWaiting}</div>
          <div className="s">listed, not sold</div>
        </a>
        <a className="stat warn wide" href={inventoryHref({ filter: "stale" })}>
          <div className="k">Stale &gt; {STALE_AFTER_DAYS} days</div>
          <div className="v">{stats.staleCount}</div>
          <div className="s">&gt; {STALE_AFTER_DAYS} days</div>
        </a>
      </div>

      {items.length === 0 && (
        <p className="notice">
          No items yet. <a href="/items/new">Add your first item</a> or{" "}
          <a href="/settings/import">import a backup</a>.
        </p>
      )}

      {stats.oldestUnsold.length > 0 && (
        <section>
          <div className="strip-head">
            <h2>Oldest on the shelf</h2>
            <a href={inventoryHref({ filter: "unsold", sort: "oldest" })}>See all</a>
          </div>
          <ul className="items">
            {stats.oldestUnsold.map((item) => (
              <li key={item.id}>
                <a className="item-link" href={`/items/${item.id}`}>
                  <div className="item">
                    {item.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/images/${item.imageKey}`} alt="" />
                    ) : (
                      <div className="thumb-empty" />
                    )}
                    <div className="body">
                      <h2>{item.title}</h2>
                      <p className="meta">
                        {daysSitting(item.purchaseDate, today)} days · paid {formatMoney(item.purchasePrice)}
                      </p>
                    </div>
                    {daysSitting(item.purchaseDate, today) > STALE_AFTER_DAYS && (
                      <span className="chip">stale</span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {soldStrip.length > 0 && (
        <section>
          <div className="strip-head">
            <h2>{period === "all" ? "Recently sold" : "Sold this month"}</h2>
            <a href={soldHref}>See all</a>
          </div>
          <ul className="items">
            {soldStrip.map((item) => (
              <li key={item.id}>
                <a className="item-link" href={`/items/${item.id}`}>
                  <div className="item">
                    {item.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/images/${item.imageKey}`} alt="" />
                    ) : (
                      <div className="thumb-empty" />
                    )}
                    <div className="body">
                      <h2>{item.title}</h2>
                      <p className="meta">
                        Sold {formatMoney(item.sellingPrice ?? 0)}
                        {item.profit != null && <> · Profit {formatMoney(item.profit)}</>}
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
```

Grid: profit `wide`, shelf + posted, stale `wide`. Four cards, no sell-through.

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parsePeriod } from "@/lib/inventoryStats";
import AppShell from "@/components/AppShell";
import HomeDashboard from "@/components/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const period = parsePeriod((await searchParams).period);
  const result = await listItems();

  return (
    <AppShell title="Home" active="home" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">
          The database is not configured yet. Set <code>NETLIFY_DB_URL</code> and apply
          migrations, then reload.
        </p>
      ) : result.status === "error" ? (
        <p className="notice">
          The inventory could not be loaded. The database reported:
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <HomeDashboard items={result.items} period={period} />
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Typecheck and unit tests**

Run: `npm run typecheck` and `npx vitest run tests/unit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeDashboard.tsx src/app/page.tsx
git commit -m "Open the app on a command-center home"
```

---

### Task 6: Inventory at `/inventory`

**Files:**
- Create: `src/components/InventoryList.tsx`
- Create: `src/app/inventory/page.tsx`

**Interfaces:**
- Consumes: `filterItems`, `parseFilter`, `parseSort`, `inventoryHref`, `FILTER_LABELS`, `InventoryFilter` from Task 3; `localToday`; `formatMoney`; `AppShell`.
- Produces: client `InventoryList({ items, filter, sort, q }: { items: InventoryItemView[]; filter: InventoryFilter; sort: InventorySort; q: string })`.
  - Heading: `{FILTER_LABELS[filter]} · {visible.length}`.
  - Search `<input className="search" placeholder="Search items…">`. Local state initialized from `q`. On form submit (Enter) and on blur, `router.push(inventoryHref({ filter, sort, q: text }))`. Do not push on every keystroke.
  - Chip row, always, as `<a>` tags: All, In stock, Scheduled, Posted, Sold, Unsold, Stale — hrefs via `inventoryHref({ filter, q })` (preserve `q`, reset sort to default except when the current filter is `unsold` and `sort=oldest` and the chip is Unsold — simplest rule: chips omit `sort`, so they go back to newest). Sold chip is `className="on"` when `filter === "sold" || filter === "sold-month"`. Other chips `on` when they equal `filter`. Sold chip href is always `filter=sold` (tapping it from sold-month drops the month).
  - Rows: same markup as today’s list (photo, title, paid, profit if sold, status badge), linking to `/items/${id}`.
  - Zero matches (but `items.length > 0`): `<p className="notice">No items match. <a href="/inventory">Clear</a></p>`.
  - Zero items at all: same empty sentence as Home (`Add your first item` / import).

- [ ] **Step 1: Write `InventoryList`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localToday } from "@/lib/dates";
import {
  FILTER_LABELS,
  filterItems,
  inventoryHref,
  type InventoryFilter,
  type InventorySort,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

const CHIPS: { filter: InventoryFilter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "in-stock", label: "In stock" },
  { filter: "scheduled", label: "Scheduled" },
  { filter: "posted", label: "Posted" },
  { filter: "sold", label: "Sold" },
  { filter: "unsold", label: "Unsold" },
  { filter: "stale", label: "Stale" },
];

export default function InventoryList({
  items,
  filter,
  sort,
  q,
}: {
  items: InventoryItemView[];
  filter: InventoryFilter;
  sort: InventorySort;
  q: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const visible = filterItems(items, { filter, sort, q, today: localToday() });

  function commitSearch(next: string) {
    router.push(inventoryHref({ filter, sort, q: next }));
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commitSearch(text);
        }}
      >
        <input
          className="search"
          value={text}
          placeholder="Search items…"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== q) commitSearch(text);
          }}
        />
      </form>

      <div className="chips">
        {CHIPS.map((chip) => {
          const on =
            chip.filter === "sold"
              ? filter === "sold" || filter === "sold-month"
              : chip.filter === filter;
          return (
            <a
              key={chip.filter}
              href={inventoryHref({ filter: chip.filter, q: text })}
              className={on ? "on" : undefined}
            >
              {chip.label}
            </a>
          );
        })}
      </div>

      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
        {FILTER_LABELS[filter]} · {visible.length}
      </h2>

      {items.length === 0 ? (
        <p className="notice">
          No items yet. <a href="/items/new">Add your first item</a> or{" "}
          <a href="/settings/import">import a backup</a>.
        </p>
      ) : visible.length === 0 ? (
        <p className="notice">
          No items match. <a href="/inventory">Clear</a>
        </p>
      ) : (
        <ul className="items">
          {visible.map((item) => (
            <li key={item.id}>
              <a className="item-link" href={`/items/${item.id}`}>
                <div className="item">
                  {item.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${item.imageKey}`} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-empty" />
                  )}
                  <div className="body">
                    <h2>{item.title}</h2>
                    <p className="meta">
                      Paid {formatMoney(item.purchasePrice)}
                      {item.profit !== null && <> · Profit {formatMoney(item.profit)}</>}
                      {item.category && <> · {item.category}</>}
                    </p>
                  </div>
                  <span className={`badge ${item.status}`}>{item.status}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: Write `src/app/inventory/page.tsx`**

```tsx
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parseFilter, parseSort } from "@/lib/inventoryStats";
import AppShell from "@/components/AppShell";
import InventoryList from "@/components/InventoryList";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string; q?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const result = await listItems();

  return (
    <AppShell title="Inventory" active="inventory" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">
          The database is not configured yet. Set <code>NETLIFY_DB_URL</code> and apply
          migrations, then reload.
        </p>
      ) : result.status === "error" ? (
        <p className="notice">
          The inventory could not be loaded. The database reported:
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <InventoryList
          items={result.items}
          filter={parseFilter(sp.filter)}
          sort={parseSort(sp.sort)}
          q={sp.q ?? ""}
        />
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` and `npx vitest run tests/unit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/InventoryList.tsx src/app/inventory/page.tsx
git commit -m "Move the working list to /inventory with search and filters"
```

---

### Task 7: Settings hub and import/export back links

**Files:**
- Create: `src/app/settings/page.tsx`
- Modify: `src/components/ExportPanel.tsx` — `href="/"` → `href="/settings"`
- Modify: `src/components/ImportWizard.tsx` — Back `href="/"` → `href="/settings"`; success `href="/"` → `href="/inventory"`

**Interfaces:**
- Consumes: `AppShell`.
- Produces: `/settings` with two cards: Export data → `/settings/export`, Import data → `/settings/import`. Tab bar on the hub. Export/import pages keep their current headers, no tabs.

- [ ] **Step 1: Write `src/app/settings/page.tsx`**

```tsx
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · Dust Gatherer" };

export default async function SettingsPage() {
  await requireSession();
  return (
    <AppShell title="Settings" active="settings">
      <ul className="settings-links">
        <li>
          <a href="/settings/export">
            <h2>Export data</h2>
            <p>Backup all items and images to a ZIP file</p>
          </a>
        </li>
        <li>
          <a href="/settings/import">
            <h2>Import data</h2>
            <p>Restore items and images from a backup</p>
          </a>
        </li>
      </ul>
    </AppShell>
  );
}
```

- [ ] **Step 2: Retarget Export and Import chrome**

In `ExportPanel.tsx`, change the Back link from `href="/"` to `href="/settings"`.

In `ImportWizard.tsx`, change:
- `<a href="/">Back</a>` → `<a href="/settings">Back</a>`
- `<a href="/">View your inventory</a>` → `<a href="/inventory">View your inventory</a>`

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/components/ExportPanel.tsx src/components/ImportWizard.tsx
git commit -m "Add settings hub and point backup pages at it"
```

---

### Task 8: Item form returns to Inventory

**Files:**
- Modify: `src/components/ItemForm.tsx`

**Interfaces:**
- Consumes: `localToday` already imported in Task 1.
- Produces: every `router.push("/")` becomes `router.push("/inventory")`; Cancel `<a href="/">` becomes `<a href="/inventory">`. Three pushes: save success, confirmSold success, onDelete success.

- [ ] **Step 1: Replace the four `/` destinations**

In `src/components/ItemForm.tsx`:
- `router.push("/")` after save → `router.push("/inventory")`
- `router.push("/")` after confirmSold → `router.push("/inventory")`
- `router.push("/")` after onDelete → `router.push("/inventory")`
- Cancel `<a href="/">Cancel</a>` → `<a href="/inventory">Cancel</a>`

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemForm.tsx
git commit -m "Return item save and cancel to the inventory list"
```

---

### Task 9: Handoff + full verification

**Files:**
- Modify: `docs/handoff.md` — Current state section
- Modify: `CLAUDE.md` — same “Not built yet” list if it still claims analytics/settings are unbuilt as a blob (keep PWA / i18n / calendar / bulk select; Home now covers the analytics job)

**Interfaces:**
- Consumes: the shipped screens.
- Produces: docs that match reality.

- [ ] **Step 1: Update `docs/handoff.md` Current state**

Replace the “Not built yet” numbered list with:

```
Working end to end: sign-in, command-center Home (this-month profit, shelf
value, posted-waiting, stale, oldest/recent strips), inventory search and
filters, item CRUD with camera capture, settings hub, backup export, the
database, image storage, and the import pipeline.

Not built yet, roughly in intended order:

1. Calendar / Schedule
2. Category and site management UI
3. The PWA shell itself — manifest, icons, service worker, install flow
4. The EN/UK i18n pass
5. Bulk select — never implemented on Android either
```

Apply the same list change to `CLAUDE.md` if that file still lists Calendar/Analytics/Settings as unbuilt together.

- [ ] **Step 2: Run the full suite**

Run:

```
npx vitest run
npm run typecheck
```

Expected: all existing tests PASS, new unit tests PASS, `tsc --noEmit` clean.

- [ ] **Step 3: Manual check against a running app** (when `npm run dev` and a database are available)

- `/` shows four tappable cards, not the 208-row list
- Tapping Stale opens `/inventory?filter=stale` with the Stale chip on and heading `Stale · N`
- All-time toggle changes only profit + sold strip
- Search + Unsold chip compose
- Add item → save lands on `/inventory`
- Settings tab → Export / Import; those pages have no tab bar; Back returns to Settings
- Login and item edit still have no tab bar

If the database is unconfigured locally, still confirm login, Home empty/unconfigured notice, and tab chrome.

- [ ] **Step 4: Commit**

```bash
git add docs/handoff.md CLAUDE.md
git commit -m "Document command-center home as current state"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| `localToday` extracted, device calendar | 1 |
| `daysSitting` UTC midnight, this-month = `YYYY-MM` prefix | 1 |
| `statsFor` cards + oldest/sold strips + empty zeros | 2 |
| Stale > 60, not ≥ 60; sold never stale | 2 |
| Shelf = unsold sum = totalSpent − COGS | 2 |
| Posted-waiting ignores leftover postedDate on sold items | 2 |
| February sale excluded from March | 2 |
| `filterItems` all named filters, `q` AND, sort oldest/newest | 3 |
| `createdAt` on the view for newest sort | 3 |
| URL helpers / `sold-month` heading label | 3 |
| AppShell tabs; + Add; no FAB; safe-area tab bar | 4 |
| Home cards, period URL, strips, empty inventory copy | 5 |
| `/inventory` search, chips, tap-through, no-match clear | 6 |
| Settings hub; export/import keep headers, no tabs | 7 |
| Form save/sold/delete/Cancel → `/inventory` | 8 |
| Unit tests only, no PGlite, no Blobs checklist | 1–3, 9 |
| No schema/API/middleware changes | all |
