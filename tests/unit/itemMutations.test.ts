import { describe, expect, it } from "vitest";
import { createItemSchema, markSoldSchema, updateItemSchema } from "@/lib/itemMutations";

const VALID_KEY = "0123456789abcdef0123456789abcdef";

describe("createItemSchema", () => {
  it("accepts a minimal payload and applies defaults", () => {
    const parsed = createItemSchema.parse({
      title: "Brass lamp",
      purchasePrice: 12.5,
      purchaseDate: "2026-08-23",
    });
    expect(parsed.description).toBe("");
    expect(parsed.sellingPrice).toBeNull();
    expect(parsed.scheduledPostDate).toBeNull();
    expect(parsed.imageKey).toBeNull();
    expect(parsed.category).toBe("");
  });

  it("rejects a blank title", () => {
    expect(
      createItemSchema.safeParse({ title: "  ", purchasePrice: 1, purchaseDate: "2026-08-23" }).success,
    ).toBe(false);
  });

  it("rejects money that overflows numeric(10,2)", () => {
    expect(
      createItemSchema.safeParse({ title: "x", purchasePrice: 100_000_000, purchaseDate: "2026-08-23" }).success,
    ).toBe(false);
  });

  it("rejects a malformed image key", () => {
    expect(
      createItemSchema.safeParse({
        title: "x", purchasePrice: 1, purchaseDate: "2026-08-23", imageKey: "../etc/passwd",
      }).success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({
        title: "x", purchasePrice: 1, purchaseDate: "2026-08-23", imageKey: VALID_KEY,
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      createItemSchema.safeParse({ title: "x", purchasePrice: 1, purchaseDate: "08/23/2026" }).success,
    ).toBe(false);
  });
});

describe("updateItemSchema", () => {
  it("additionally accepts postedDate", () => {
    const parsed = updateItemSchema.parse({
      title: "x", purchasePrice: 1, purchaseDate: "2026-08-23", postedDate: "2026-08-24",
    });
    expect(parsed.postedDate).toBe("2026-08-24");
  });

  it("has no soldDate field: regular saves can never write it", () => {
    const parsed = updateItemSchema.parse({
      title: "x", purchasePrice: 1, purchaseDate: "2026-08-23", soldDate: "2026-08-24",
    });
    expect("soldDate" in parsed).toBe(false);
  });
});

describe("markSoldSchema", () => {
  it("requires a positive price, matching MarkAsSoldDialog", () => {
    expect(markSoldSchema.safeParse({ sellingPrice: 0, soldDate: "2026-08-23" }).success).toBe(false);
    expect(markSoldSchema.safeParse({ sellingPrice: 25, soldDate: "2026-08-23" }).success).toBe(true);
  });
});
