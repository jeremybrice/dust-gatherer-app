// Pure port of CalendarViewModel.kt (git history before 46d7f5f) plus the
// calendar-grid arithmetic CalendarScreen.kt did inline. Every date is a
// `YYYY-MM-DD` string and every calculation goes through Date.UTC, so neither
// the server's UTC clock nor the phone's timezone can move a day.

import type { Lang } from "@/lib/i18n";
import type { InventoryItemView } from "@/lib/items";
import type { ScheduleAssignment } from "@/lib/itemMutations";

/** 0 = Sunday-first (Android, English), 1 = Monday-first (Ukrainian). */
export type WeekStart = 0 | 1;

export function weekStartFor(lang: Lang): WeekStart {
  return lang === "uk" ? 1 : 0;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM = /^(\d{4})-(\d{2})$/;

function toUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO weekday, 1 = Monday .. 7 = Sunday. */
export function isoWeekday(ymd: string): number {
  const day = toUtc(ymd).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(ymd: string, n: number): string {
  const d = toUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function shiftMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(raw: string | null | undefined, today: string): string {
  if (raw && YM.test(raw)) {
    const m = Number(raw.slice(5));
    if (m >= 1 && m <= 12) return raw;
  }
  return today.slice(0, 7);
}

/** A real calendar day or null; "2026-09-31" is rejected, not rolled over. */
export function parseDay(raw: string | null | undefined): string | null {
  if (!raw || !YMD.test(raw)) return null;
  return fromUtc(toUtc(raw)) === raw ? raw : null;
}

export interface MonthGrid {
  month: string;
  /** Empty cells before the 1st so weekdays line up under the headers. */
  leading: number;
  days: string[];
}

export function monthGrid(yyyyMM: string, weekStart: WeekStart): MonthGrid {
  const [y, m] = yyyyMM.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = (first.getUTCDay() - weekStart + 7) % 7;
  const days: string[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(`${yyyyMM}-${String(d).padStart(2, "0")}`);
  }
  return { month: yyyyMM, leading, days };
}

/** ISO weekdays in display order for the header row. */
export function weekdayHeaders(weekStart: WeekStart): number[] {
  return weekStart === 1 ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6];
}

/** Port of getNextPostingDays: today counts if it is a posting day. */
export function nextPostingDays(today: string, postingDays: number[], count: number): string[] {
  if (postingDays.length === 0 || count <= 0) return [];
  const wanted = new Set(postingDays);
  const out: string[] = [];
  let cursor = today;
  while (out.length < count) {
    if (wanted.has(isoWeekday(cursor))) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Items that still need a posting slot. Android's DAO was "no scheduled date
 * and not sold"; posted items are excluded here as well, because an item that
 * is already listed has nothing left to schedule. Order matches the DAO:
 * purchaseDate DESC, newest finds first.
 */
export function unscheduledItems(items: InventoryItemView[]): InventoryItemView[] {
  return items
    .filter((i) => i.scheduledPostDate == null && i.soldDate == null && i.postedDate == null)
    .sort((a, b) => {
      if (a.purchaseDate !== b.purchaseDate) return a.purchaseDate < b.purchaseDate ? 1 : -1;
      return b.id - a.id;
    });
}

/** Every item with a scheduled date, by day, each day sorted by title like
 *  getItemsScheduledFor. Sold and posted items stay: the calendar is history too. */
export function groupByScheduledDate(items: InventoryItemView[]): Map<string, InventoryItemView[]> {
  const out = new Map<string, InventoryItemView[]>();
  for (const item of items) {
    if (!item.scheduledPostDate) continue;
    const list = out.get(item.scheduledPostDate) ?? [];
    list.push(item);
    out.set(item.scheduledPostDate, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

/** Port of autoScheduleItems: one item per upcoming posting day. */
export function autoSchedulePlan(
  unscheduled: InventoryItemView[],
  today: string,
  postingDays: number[],
): ScheduleAssignment[] {
  const slots = nextPostingDays(today, postingDays, unscheduled.length);
  return unscheduled.slice(0, slots.length).map((item, i) => ({ id: item.id, date: slots[i] }));
}
