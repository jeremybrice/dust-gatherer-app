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
