import { describe, it, expect } from "vitest";
import {
  IDENTICAL_OK,
  LANG_COOKIE,
  langCookieString,
  parseLang,
  t,
} from "@/lib/i18n";
import en from "../../i18n/en.json";
import uk from "../../i18n/uk.json";

describe("parseLang", () => {
  it("defaults anything but uk to en", () => {
    expect(parseLang(undefined)).toBe("en");
    expect(parseLang(null)).toBe("en");
    expect(parseLang("")).toBe("en");
    expect(parseLang("en")).toBe("en");
    expect(parseLang("uk")).toBe("uk");
    expect(parseLang("UK")).toBe("en");
    expect(parseLang("fr")).toBe("en");
  });
});

describe("t", () => {
  it("interpolates Android placeholders", () => {
    expect(t("en", "sold_count", { "1": 3 })).toBe("3 sold");
    expect(t("uk", "sold_count", { "1": 3 })).toBe("3 продано");
    expect(t("en", "days_paid", { "1": 12, "2": "$5.00" })).toBe("12 days · paid $5.00");
  });

  it("falls back to English, then the key", () => {
    expect(t("uk", "app_name")).toBe("Dust Gatherer");
    expect(t("en", "does_not_exist")).toBe("does_not_exist");
  });
});

describe("dictionaries", () => {
  it("has the same keys in both files, translated unless allowlisted", () => {
    const enKeys = Object.keys(en).sort();
    const ukKeys = Object.keys(uk).sort();
    expect(ukKeys).toEqual(enKeys);
    for (const key of enKeys) {
      expect(en[key as keyof typeof en].length).toBeGreaterThan(0);
      expect(uk[key as keyof typeof uk].length).toBeGreaterThan(0);
      if (!IDENTICAL_OK.has(key)) {
        expect(uk[key as keyof typeof uk], key).not.toBe(en[key as keyof typeof en]);
      }
    }
  });
});

describe("langCookieString", () => {
  it("writes the non-httpOnly preference cookie", () => {
    expect(langCookieString("uk", true)).toBe(
      `${LANG_COOKIE}=uk; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
    expect(langCookieString("en", false)).toBe(
      `${LANG_COOKIE}=en; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });
});
