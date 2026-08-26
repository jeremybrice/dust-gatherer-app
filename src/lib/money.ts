import type { Lang } from "@/lib/i18n";

export function localeFor(lang: Lang): string {
  return lang === "uk" ? "uk-UA" : "en-US";
}

export function formatMoney(n: number, lang: Lang = "en"): string {
  return n.toLocaleString(localeFor(lang), { style: "currency", currency: "USD" });
}
