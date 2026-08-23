import { describe, it, expect } from "vitest";
import { applyStatusChange, deriveProfit, deriveStatus } from "@/lib/itemStatus";

const dates = (o: Partial<Parameters<typeof deriveStatus>[0]> = {}) => ({
  scheduledPostDate: null, postedDate: null, soldDate: null, ...o,
});

describe("deriveStatus", () => {
  it("reports INVENTORY when no lifecycle date is set", () => {
    expect(deriveStatus(dates())).toBe("INVENTORY");
  });

  it("reports each stage from its own date", () => {
    expect(deriveStatus(dates({ scheduledPostDate: "2026-01-01" }))).toBe("SCHEDULED");
    expect(deriveStatus(dates({ postedDate: "2026-01-01" }))).toBe("POSTED");
    expect(deriveStatus(dates({ soldDate: "2026-01-01" }))).toBe("SOLD");
  });

  // Precedence is the part a naive port gets wrong: an item keeps its earlier
  // dates as it advances, so the LATEST stage must win.
  it("prefers the latest stage when earlier dates are still present", () => {
    expect(deriveStatus(dates({
      scheduledPostDate: "2026-01-01", postedDate: "2026-01-05",
    }))).toBe("POSTED");
    expect(deriveStatus(dates({
      scheduledPostDate: "2026-01-01", postedDate: "2026-01-05", soldDate: "2026-01-09",
    }))).toBe("SOLD");
  });
});

describe("deriveProfit", () => {
  it("is the margin once sold", () => {
    expect(deriveProfit({ purchasePrice: 10, sellingPrice: 25, soldDate: "2026-01-01" })).toBe(15);
  });

  it("can be negative", () => {
    expect(deriveProfit({ purchasePrice: 30, sellingPrice: 25, soldDate: "2026-01-01" })).toBe(-5);
  });

  // An asking price on an unsold item is not realised profit.
  it("is null without both a selling price and a sold date", () => {
    expect(deriveProfit({ purchasePrice: 10, sellingPrice: 25, soldDate: null })).toBeNull();
    expect(deriveProfit({ purchasePrice: 10, sellingPrice: null, soldDate: "2026-01-01" })).toBeNull();
    expect(deriveProfit({ purchasePrice: 10, sellingPrice: null, soldDate: null })).toBeNull();
  });
});

describe("applyStatusChange", () => {
  const today = "2026-08-23";

  it("INVENTORY clears scheduled and posted dates", () => {
    expect(
      applyStatusChange("INVENTORY", { scheduledPostDate: "2026-08-01", postedDate: "2026-08-05" }, today),
    ).toEqual({ scheduledPostDate: null, postedDate: null });
  });

  it("SCHEDULED keeps an existing scheduled date and clears posted", () => {
    expect(
      applyStatusChange("SCHEDULED", { scheduledPostDate: "2026-08-01", postedDate: "2026-08-05" }, today),
    ).toEqual({ scheduledPostDate: "2026-08-01", postedDate: null });
  });

  it("SCHEDULED defaults a missing scheduled date to today", () => {
    expect(
      applyStatusChange("SCHEDULED", { scheduledPostDate: null, postedDate: null }, today),
    ).toEqual({ scheduledPostDate: today, postedDate: null });
  });

  it("POSTED keeps an existing posted date", () => {
    expect(
      applyStatusChange("POSTED", { scheduledPostDate: "2026-08-01", postedDate: "2026-08-05" }, today),
    ).toEqual({ scheduledPostDate: "2026-08-01", postedDate: "2026-08-05" });
  });

  it("POSTED defaults a missing posted date to today and keeps scheduled", () => {
    expect(
      applyStatusChange("POSTED", { scheduledPostDate: "2026-08-01", postedDate: null }, today),
    ).toEqual({ scheduledPostDate: "2026-08-01", postedDate: today });
  });
});
