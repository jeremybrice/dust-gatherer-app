import { describe, it, expect } from "vitest";
import { deriveProfit, deriveStatus } from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import {
  addDays,
  autoSchedulePlan,
  groupByScheduledDate,
  isoWeekday,
  monthGrid,
  nextPostingDays,
  parseDay,
  parseMonth,
  shiftMonth,
  unscheduledItems,
  weekStartFor,
  weekdayHeaders,
} from "@/lib/schedule";

function view(
  over: Partial<InventoryItemView> & { id: number; title: string },
): InventoryItemView {
  const base: InventoryItemView = {
    description: "", purchasePrice: 10, sellingPrice: null, purchaseDate: "2026-01-01",
    scheduledPostDate: null, postedDate: null, soldDate: null, imageKey: null,
    purchaseLocation: "", category: "", site: "", notes: "",
    createdAt: "2026-08-01T00:00:00.000Z", status: "INVENTORY", profit: null, ...over,
  };
  return { ...base, status: deriveStatus(base), profit: deriveProfit(base) };
}

describe("date helpers", () => {
  it("computes ISO weekdays and day arithmetic in UTC", () => {
    expect(isoWeekday("2026-09-02")).toBe(3); // Wednesday
    expect(isoWeekday("2026-09-06")).toBe(7); // Sunday
    expect(isoWeekday("2026-09-07")).toBe(1); // Monday
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("shifts and parses months, falling back to today's month", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(parseMonth("2026-09", "2026-09-02")).toBe("2026-09");
    expect(parseMonth("2026-13", "2026-09-02")).toBe("2026-09");
    expect(parseMonth(undefined, "2026-09-02")).toBe("2026-09");
    expect(parseDay("2026-09-10")).toBe("2026-09-10");
    expect(parseDay("2026-09-31")).toBeNull();
    expect(parseDay("nope")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
});

describe("monthGrid", () => {
  it("lays out September 2026 Monday-first and Sunday-first", () => {
    // 1 Sep 2026 is a Tuesday.
    const mon = monthGrid("2026-09", 1);
    expect(mon.leading).toBe(1);
    expect(mon.days).toHaveLength(30);
    expect(mon.days[0]).toBe("2026-09-01");
    expect(mon.days[29]).toBe("2026-09-30");

    const sun = monthGrid("2026-09", 0);
    expect(sun.leading).toBe(2);
  });

  it("orders weekday headers from the week start", () => {
    expect(weekdayHeaders(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdayHeaders(0)).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(weekStartFor("uk")).toBe(1);
    expect(weekStartFor("en")).toBe(0);
  });
});

describe("nextPostingDays", () => {
  it("includes today when it is a posting day and walks forward across months", () => {
    // 2026-09-02 is a Wednesday.
    expect(nextPostingDays("2026-09-02", [1, 3, 5], 4)).toEqual([
      "2026-09-02", "2026-09-04", "2026-09-07", "2026-09-09",
    ]);
    expect(nextPostingDays("2026-09-29", [7], 2)).toEqual(["2026-10-04", "2026-10-11"]);
    expect(nextPostingDays("2026-09-02", [], 3)).toEqual([]);
  });
});

describe("unscheduledItems", () => {
  it("keeps in-stock items only, newest purchase first", () => {
    const items = [
      view({ id: 1, title: "old", purchaseDate: "2026-01-01" }),
      view({ id: 2, title: "new", purchaseDate: "2026-08-01" }),
      view({ id: 3, title: "scheduled", scheduledPostDate: "2026-09-10" }),
      view({ id: 4, title: "posted", postedDate: "2026-08-20" }),
      view({ id: 5, title: "sold", sellingPrice: 20, soldDate: "2026-08-25" }),
      view({ id: 6, title: "same day", purchaseDate: "2026-08-01" }),
    ];
    expect(unscheduledItems(items).map((i) => i.id)).toEqual([6, 2, 1]);
  });
});

describe("groupByScheduledDate", () => {
  it("groups by date and sorts each day by title", () => {
    const items = [
      view({ id: 1, title: "b", scheduledPostDate: "2026-09-10" }),
      view({ id: 2, title: "a", scheduledPostDate: "2026-09-10" }),
      view({ id: 3, title: "c", scheduledPostDate: "2026-09-12" }),
      view({ id: 4, title: "none" }),
    ];
    const g = groupByScheduledDate(items);
    expect([...g.keys()].sort()).toEqual(["2026-09-10", "2026-09-12"]);
    expect(g.get("2026-09-10")!.map((i) => i.title)).toEqual(["a", "b"]);
  });
});

describe("autoSchedulePlan", () => {
  it("assigns one item per upcoming posting day in unscheduled order", () => {
    const items = [
      view({ id: 1, title: "old", purchaseDate: "2026-01-01" }),
      view({ id: 2, title: "new", purchaseDate: "2026-08-01" }),
      view({ id: 3, title: "sold", sellingPrice: 20, soldDate: "2026-08-25" }),
    ];
    expect(autoSchedulePlan(unscheduledItems(items), "2026-09-02", [1, 3, 5])).toEqual([
      { id: 2, date: "2026-09-02" },
      { id: 1, date: "2026-09-04" },
    ]);
    expect(autoSchedulePlan([], "2026-09-02", [1, 3, 5])).toEqual([]);
    expect(autoSchedulePlan(unscheduledItems(items), "2026-09-02", [])).toEqual([]);
  });
});
