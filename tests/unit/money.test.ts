import { describe, it, expect } from "vitest";
import { formatMoney, localeFor } from "@/lib/money";

describe("localeFor", () => {
  it("maps lang to a BCP 47 tag", () => {
    expect(localeFor("en")).toBe("en-US");
    expect(localeFor("uk")).toBe("uk-UA");
  });
});

describe("formatMoney", () => {
  it("keeps USD but changes the locale grouping", () => {
    const en = formatMoney(1234, "en");
    const uk = formatMoney(1234, "uk");
    expect(en).not.toBe(uk);
    expect(en).toMatch(/1,234/);
  });
});
