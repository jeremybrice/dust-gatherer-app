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

describe("monthLabel locale", () => {
  it("names August in Ukrainian when asked", () => {
    expect(monthLabel("2026-08-24", "uk")).not.toBe("August");
    expect(monthLabel("2026-08-24", "uk").toLowerCase()).toContain("серп");
  });
});
