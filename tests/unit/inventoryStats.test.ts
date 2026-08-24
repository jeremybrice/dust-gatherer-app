import { describe, it, expect } from "vitest";
import { deriveProfit, deriveStatus } from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import { STALE_AFTER_DAYS, statsFor } from "@/lib/inventoryStats";

function view(
  over: Partial<InventoryItemView> & { id: number; title: string },
): InventoryItemView {
  const base: InventoryItemView = {
    description: "",
    purchasePrice: 10,
    sellingPrice: null,
    purchaseDate: "2026-01-01",
    scheduledPostDate: null,
    postedDate: null,
    soldDate: null,
    imageKey: null,
    purchaseLocation: "",
    category: "",
    site: "",
    notes: "",
    status: "INVENTORY",
    profit: null,
    ...over,
  };
  return {
    ...base,
    status: deriveStatus(base),
    profit: deriveProfit(base),
  };
}

const TODAY = "2026-08-24";

describe("statsFor", () => {
  it("returns zeros and empty strips for an empty list", () => {
    expect(statsFor([], TODAY)).toEqual({
      thisMonth: { revenue: 0, profit: 0, soldCount: 0, margin: null },
      allTime: { revenue: 0, profit: 0, soldCount: 0, margin: null },
      shelfValue: 0,
      unsoldCount: 0,
      postedWaiting: 0,
      staleCount: 0,
      oldestUnsold: [],
      soldThisMonth: [],
      soldAllTime: [],
    });
  });

  it("ignores a sale from another month in this-month profit", () => {
    const items = [
      view({
        id: 1, title: "aug", purchasePrice: 10, sellingPrice: 40,
        soldDate: "2026-08-10",
      }),
      view({
        id: 2, title: "jul", purchasePrice: 5, sellingPrice: 20,
        soldDate: "2026-07-31",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.thisMonth).toEqual({
      revenue: 40, profit: 30, soldCount: 1, margin: 30 / 40,
    });
    expect(s.allTime).toEqual({
      revenue: 60, profit: 45, soldCount: 2, margin: 45 / 60,
    });
  });

  it("treats on-the-shelf as unsold purchase sum, equal to totalSpent - COGS", () => {
    const items = [
      view({ id: 1, title: "kept", purchasePrice: 12, purchaseDate: "2026-08-01" }),
      view({
        id: 2, title: "sold", purchasePrice: 8, sellingPrice: 20,
        soldDate: "2026-08-10",
      }),
    ];
    const s = statsFor(items, TODAY);
    const totalSpent = 12 + 8;
    const cogs = 8;
    expect(s.shelfValue).toBe(12);
    expect(s.shelfValue).toBe(totalSpent - cogs);
    expect(s.unsoldCount).toBe(1);
  });

  it("counts posted-waiting only when posted and not sold", () => {
    const items = [
      view({ id: 1, title: "live", postedDate: "2026-08-01" }),
      view({
        id: 2, title: "sold leftover posted", postedDate: "2026-07-01",
        sellingPrice: 15, soldDate: "2026-08-02",
      }),
    ];
    expect(statsFor(items, TODAY).postedWaiting).toBe(1);
  });

  it("counts stale at 61 days, not 60, and never counts sold items", () => {
    expect(STALE_AFTER_DAYS).toBe(60);
    const items = [
      view({ id: 1, title: "61d", purchaseDate: "2026-06-24" }),
      view({ id: 2, title: "60d", purchaseDate: "2026-06-25" }),
      view({
        id: 3, title: "sold old", purchaseDate: "2026-01-01",
        sellingPrice: 20, soldDate: "2026-08-01",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.staleCount).toBe(1);
    expect(s.oldestUnsold.map((i) => i.title)).toEqual(["61d", "60d"]);
  });

  it("does not put a February sale into March this-month", () => {
    const items = [
      view({
        id: 1, title: "feb", purchasePrice: 10, sellingPrice: 25,
        soldDate: "2026-02-28",
      }),
    ];
    const s = statsFor(items, "2026-03-01");
    expect(s.thisMonth.soldCount).toBe(0);
    expect(s.thisMonth.revenue).toBe(0);
    expect(s.allTime.soldCount).toBe(1);
    expect(s.soldThisMonth).toEqual([]);
    expect(s.soldAllTime).toHaveLength(1);
  });

  it("caps strips at three and orders oldest / most-recently-sold", () => {
    const items = [
      view({ id: 1, title: "old-a", purchaseDate: "2026-01-01" }),
      view({ id: 2, title: "old-b", purchaseDate: "2026-02-01" }),
      view({ id: 3, title: "old-c", purchaseDate: "2026-03-01" }),
      view({ id: 4, title: "old-d", purchaseDate: "2026-04-01" }),
      view({
        id: 10, title: "sale-early", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-01",
      }),
      view({
        id: 11, title: "sale-mid", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-10",
      }),
      view({
        id: 12, title: "sale-late-low", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-20",
      }),
      view({
        id: 13, title: "sale-late-high", purchasePrice: 1, sellingPrice: 2,
        soldDate: "2026-08-20",
      }),
    ];
    const s = statsFor(items, TODAY);
    expect(s.oldestUnsold.map((i) => i.title)).toEqual(["old-a", "old-b", "old-c"]);
    expect(s.soldThisMonth.map((i) => i.title)).toEqual([
      "sale-late-high", "sale-late-low", "sale-mid",
    ]);
  });
});
