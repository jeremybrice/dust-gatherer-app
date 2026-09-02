import type { Lang } from "@/lib/i18n";
import { localeFor } from "@/lib/money";

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

/** `YYYY-MM-DD` as a short day-and-month label ("Sep 10", "10 вер."), parsed
 *  as UTC so the calendar day cannot slip in a western timezone. */
export function shortDate(ymd: string, lang: Lang = "en"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(localeFor(lang), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function monthLabel(today: string, lang: Lang = "en"): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(localeFor(lang), {
    month: "long",
    timeZone: "UTC",
  });
}
