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

export const FILTER_KEYS: Record<InventoryFilter, string> = {
  all: "filter_all",
  "in-stock": "chip_in_stock",
  scheduled: "chip_scheduled",
  posted: "chip_posted",
  sold: "chip_sold",
  "sold-month": "sold_this_month",
  unsold: "on_the_shelf",
  stale: "stale",
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
