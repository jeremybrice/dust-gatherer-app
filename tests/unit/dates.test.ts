import { describe, it, expect } from "vitest";
import {
  daysSitting, localToday, longDate, monthLabel, monthYearLabel, sameMonth, shortDate, weekdayShort,
} from "@/lib/dates";

describe("calendar labels", () => {
  it("names weekdays from ISO numbers, the month with its year, and a full day", () => {
    expect(weekdayShort(1)).toBe("Mon");
    expect(weekdayShort(7)).toBe("Sun");
    expect(weekdayShort(1, "uk").toLowerCase()).toContain("пн");
    expect(monthYearLabel("2026-09")).toBe("September 2026");
    expect(monthYearLabel("2026-09", "uk")).toContain("2026");
    expect(longDate("2026-09-02")).toBe("Wednesday, September 2");
    expect(longDate("2026-09-02", "uk")).toContain("2");
  });
});

describe("shortDate", () => {
  it("shows day and short month without timezone drift", () => {
    expect(shortDate("2026-09-10")).toBe("Sep 10");
    expect(shortDate("2026-01-01")).toBe("Jan 1");
    expect(shortDate("2026-09-10", "uk").toLowerCase()).toContain("вер");
    expect(shortDate("2026-09-10", "uk")).toContain("10");
  });
});

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
