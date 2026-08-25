import { describe, it, expect } from "vitest";
import { deriveProfit, deriveStatus } from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import {
  FILTER_KEYS,
  STALE_AFTER_DAYS,
  filterItems,
  inventoryHref,
  parseFilter,
  parsePeriod,
  parseSort,
  statsFor,
  type InventoryFilter,
} from "@/lib/inventoryStats";

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
    createdAt: "2026-08-01T00:00:00.000Z",
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

describe("parse helpers", () => {
  it("defaults unknown filter/sort/period", () => {
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter("nope")).toBe("all");
    expect(parseFilter("stale")).toBe("stale");
    expect(parseSort(undefined)).toBe("newest");
    expect(parseSort("oldest")).toBe("oldest");
    expect(parsePeriod(undefined)).toBe("month");
    expect(parsePeriod("all")).toBe("all");
  });
});

describe("inventoryHref", () => {
  it("omits default query params", () => {
    expect(inventoryHref({})).toBe("/inventory");
    expect(inventoryHref({ filter: "all", sort: "newest" })).toBe("/inventory");
    expect(inventoryHref({ filter: "stale" })).toBe("/inventory?filter=stale");
    expect(inventoryHref({ filter: "unsold", sort: "oldest" })).toBe(
      "/inventory?filter=unsold&sort=oldest",
    );
    expect(inventoryHref({ q: "bowl" })).toBe("/inventory?q=bowl");
  });
});

describe("filterItems", () => {
  const items = [
    view({ id: 1, title: "Pyrex bowl", purchaseDate: "2026-01-01", createdAt: "2026-08-20T00:00:00.000Z" }),
    view({ id: 2, title: "Wool coat", postedDate: "2026-08-01", purchaseDate: "2026-06-01", createdAt: "2026-08-19T00:00:00.000Z" }),
    view({
      id: 3, title: "Jadeite mug", purchasePrice: 5, sellingPrice: 28,
      soldDate: "2026-08-12", purchaseDate: "2026-07-01",
      createdAt: "2026-08-18T00:00:00.000Z",
    }),
    view({
      id: 4, title: "Brass lamp", scheduledPostDate: "2026-08-30",
      purchaseDate: "2026-06-24", createdAt: "2026-08-17T00:00:00.000Z",
    }),
    view({
      id: 5, title: "July sale", purchasePrice: 4, sellingPrice: 10,
      soldDate: "2026-07-04", createdAt: "2026-07-04T00:00:00.000Z",
    }),
  ];

  const opts = (filter: InventoryFilter, extra: { sort?: "newest" | "oldest"; q?: string } = {}) =>
    ({ filter, sort: extra.sort ?? "newest", q: extra.q ?? "", today: TODAY });

  it("filters each named set", () => {
    expect(filterItems(items, opts("unsold")).map((i) => i.id).sort()).toEqual([1, 2, 4]);
    expect(filterItems(items, opts("posted")).map((i) => i.id)).toEqual([2]);
    expect(filterItems(items, opts("stale")).map((i) => i.id).sort()).toEqual([1, 2, 4]);
    expect(filterItems(items, opts("sold-month")).map((i) => i.id)).toEqual([3]);
    expect(filterItems(items, opts("sold")).map((i) => i.id).sort()).toEqual([3, 5]);
    expect(filterItems(items, opts("in-stock")).map((i) => i.id)).toEqual([1]);
    expect(filterItems(items, opts("scheduled")).map((i) => i.id)).toEqual([4]);
  });

  it("ANDs a case-insensitive title substring with the filter", () => {
    expect(filterItems(items, opts("unsold", { q: "WOOL" })).map((i) => i.id)).toEqual([2]);
    expect(filterItems(items, opts("unsold", { q: "nope" }))).toEqual([]);
  });

  it("sorts oldest by purchaseDate then id", () => {
    expect(
      filterItems(items, opts("unsold", { sort: "oldest" })).map((i) => i.title),
    ).toEqual(["Pyrex bowl", "Wool coat", "Brass lamp"]);
  });

  it("sorts newest by createdAt then id", () => {
    expect(
      filterItems(items, opts("all", { sort: "newest" })).map((i) => i.id),
    ).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("FILTER_KEYS", () => {
  it("names sold-month distinctly", () => {
    expect(FILTER_KEYS["sold-month"]).toBe("sold_this_month");
    expect(FILTER_KEYS.stale).toBe("stale");
  });
});
