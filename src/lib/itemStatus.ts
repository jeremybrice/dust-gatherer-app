// Pure port of the computed properties on InventoryItem.kt.
//
// Both are derived, never stored: the dates are the single source of truth, so
// a status column could disagree with them after any partial update.

export const ITEM_STATUSES = ["INVENTORY", "SCHEDULED", "POSTED", "SOLD"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Dates an item carries, as ISO `YYYY-MM-DD` strings or null. */
export interface StatusDates {
  scheduledPostDate: string | null;
  postedDate: string | null;
  soldDate: string | null;
}

/**
 * Mirrors InventoryItem.status exactly, including its precedence: the checks
 * run sold → posted → scheduled, so an item that was scheduled AND later sold
 * reports SOLD rather than SCHEDULED.
 */
export function deriveStatus(item: StatusDates): ItemStatus {
  if (item.soldDate != null) return "SOLD";
  if (item.postedDate != null) return "POSTED";
  if (item.scheduledPostDate != null) return "SCHEDULED";
  return "INVENTORY";
}

/**
 * Mirrors InventoryItem.profit: null unless the item has BOTH a selling price
 * and a sold date. A selling price alone is an asking price, not a realised
 * one, so it must not count toward profit.
 */
export function deriveProfit(item: {
  purchasePrice: number;
  sellingPrice: number | null;
  soldDate: string | null;
}): number | null {
  if (item.sellingPrice == null || item.soldDate == null) return null;
  return item.sellingPrice - item.purchasePrice;
}

/** Statuses the user can select directly; SOLD is only reachable through the
 *  Mark as Sold flow, exactly as on Android. */
export type SelectableStatus = Exclude<ItemStatus, "SOLD">;

export interface MutableStatusDates {
  scheduledPostDate: string | null;
  postedDate: string | null;
}

/**
 * Pure port of ItemDetailViewModel.changeStatus (git history before 46d7f5f).
 * Runs client-side against the form's date fields, because the Android
 * dropdown displayed the status derived live from those fields and selecting
 * an option mutated them in place. `today` is the DEVICE's calendar date,
 * supplied by the caller, so a server timezone can never shift the day.
 */
export function applyStatusChange(
  requested: SelectableStatus,
  current: MutableStatusDates,
  today: string,
): MutableStatusDates {
  switch (requested) {
    case "INVENTORY":
      return { scheduledPostDate: null, postedDate: null };
    case "SCHEDULED":
      return { scheduledPostDate: current.scheduledPostDate ?? today, postedDate: null };
    case "POSTED":
      return { scheduledPostDate: current.scheduledPostDate, postedDate: current.postedDate ?? today };
  }
}
