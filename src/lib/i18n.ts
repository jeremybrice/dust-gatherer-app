import en from "../../i18n/en.json";
import uk from "../../i18n/uk.json";

export type Lang = "en" | "uk";

export const LANG_COOKIE = "dg-lang";
export const LANG_MAX_AGE_SECONDS = 31536000;

export const IDENTICAL_OK: ReadonlySet<string> = new Set([
  "app_name",
  "language_en",
  "language_uk",
]);

const dicts: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  uk: uk as Record<string, string>,
};

export function parseLang(raw: string | undefined | null): Lang {
  return raw === "uk" ? "uk" : "en";
}

export function t(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = dicts[lang] ?? dicts.en;
  let out = table[key] ?? dicts.en[key] ?? key;
  if (vars) {
    out = out.replace(/%(\d+)\$[sd]/g, (whole, n: string) => {
      const v = vars[n];
      return v === undefined ? whole : String(v);
    });
  }
  return out;
}

export function langCookieString(lang: Lang, secure: boolean): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_MAX_AGE_SECONDS}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}
