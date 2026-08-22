import { describe, it, expect } from "vitest";
import { planImport, toRow } from "@/lib/importMapping";
import type { ExportItem } from "@/lib/exportFormat";

const item = (o: Partial<ExportItem> = {}): ExportItem => ({
  id: 1, title: "Item", description: "", purchasePrice: 10, sellingPrice: null,
  purchaseDate: "2026-01-01", scheduledPostDate: null, postedDate: null, soldDate: null,
  imageFileName: null, purchaseLocation: "", category: "", site: "", notes: "",
  createdAt: 1737000000000, updatedAt: 1738000000000, ...o,
});

describe("toRow", () => {
  it("converts epoch milliseconds to dates and keeps calendar dates as strings", () => {
    const row = toRow(item(), null, false);
    expect(row.createdAt).toEqual(new Date(1737000000000));
    expect(row.purchaseDate).toBe("2026-01-01");
  });

  it("omits the id unless the row is replacing a specific one", () => {
    expect(toRow(item({ id: 9 }), null, false).id).toBeUndefined();
    expect(toRow(item({ id: 9 }), null, true).id).toBe(9);
  });

  it("substitutes the uploaded blob key for the archive filename", () => {
    expect(toRow(item({ imageFileName: "a.jpg" }), "deadbeef", false).imageKey).toBe("deadbeef");
  });
});

describe("planImport", () => {
  const keys = new Map([["a.jpg", "key-a"]]);

  it("inserts everything when nothing exists, whatever the strategy", () => {
    for (const s of ["SKIP_EXISTING", "REPLACE_EXISTING", "IMPORT_AS_NEW"] as const) {
      const plan = planImport([item({ id: 7 })], new Set(), s, keys);
      expect(plan.inserts).toHaveLength(1);
      expect(plan.skipped).toBe(0);
      expect(plan.inserts[0].replaceId).toBeNull();
      // The archive's id is preserved, so re-importing recognises the row
      // rather than duplicating it.
      expect(plan.inserts[0].row.id).toBe(7);
    }
  });

  it("SKIP_EXISTING leaves an existing id untouched", () => {
    const plan = planImport([item({ id: 1 }), item({ id: 2 })], new Set([1]), "SKIP_EXISTING", keys);
    expect(plan.skipped).toBe(1);
    expect(plan.inserts).toHaveLength(1);
  });

  it("REPLACE_EXISTING overwrites in place, preserving the id", () => {
    const plan = planImport([item({ id: 1 })], new Set([1]), "REPLACE_EXISTING", keys);
    expect(plan.inserts[0].replaceId).toBe(1);
    expect(plan.inserts[0].row.id).toBe(1);
  });

  it("IMPORT_AS_NEW duplicates rather than overwrites", () => {
    const plan = planImport([item({ id: 1 })], new Set([1]), "IMPORT_AS_NEW", keys);
    expect(plan.skipped).toBe(0);
    expect(plan.inserts[0].replaceId).toBeNull();
    // Only a genuine collision drops the id and lets Postgres assign one.
    expect(plan.inserts[0].row.id).toBeUndefined();
  });

  it("leaves imageKey null when the archive has no matching file", () => {
    const plan = planImport([item({ imageFileName: "missing.jpg" })], new Set(), "IMPORT_AS_NEW", keys);
    expect(plan.inserts[0].row.imageKey).toBeNull();
  });
});
