import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDrizzle } from "../helpers/pg";
import { inventoryItems } from "@/lib/schema";
import {
  createItem,
  createItemSchema,
  deleteItem,
  markItemSold,
  updateItem,
  updateItemSchema,
} from "@/lib/itemMutations";

const KEY_A = "0123456789abcdef0123456789abcdef";
const KEY_B = "ffffffffffffffffffffffffffffffff";

function basePayload() {
  return createItemSchema.parse({
    title: "Brass lamp",
    purchasePrice: 12.5,
    purchaseDate: "2026-08-23",
    imageKey: KEY_A,
  });
}

describe("item CRUD over PGlite", () => {
  it("creates an item with a generated id and null status dates", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.title).toBe("Brass lamp");
    expect(row.purchasePrice).toBe(12.5);
    expect(row.postedDate).toBeNull();
    expect(row.soldDate).toBeNull();
    expect(row.imageKey).toBe(KEY_A);
  });

  it("update preserves createdAt and soldDate and reports the previous image key", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    await markItemSold(id, { sellingPrice: 40, soldDate: "2026-08-20" }, db);
    const [before] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));

    const result = await updateItem(
      id,
      updateItemSchema.parse({
        title: "Brass lamp, polished",
        purchasePrice: 12.5,
        purchaseDate: "2026-08-23",
        postedDate: "2026-08-18",
        imageKey: KEY_B,
      }),
      db,
    );

    expect(result).toEqual({ outcome: "updated", previousImageKey: KEY_A });
    const [after] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(after.title).toBe("Brass lamp, polished");
    expect(after.imageKey).toBe(KEY_B);
    expect(after.postedDate).toBe("2026-08-18");
    expect(after.soldDate).toBe("2026-08-20");
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  it("markItemSold sets the price and sold date", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    expect(await markItemSold(id, { sellingPrice: 55.25, soldDate: "2026-08-23" }, db)).toBe("updated");
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.sellingPrice).toBe(55.25);
    expect(row.soldDate).toBe("2026-08-23");
  });

  it("delete removes the row and returns the image key for blob cleanup", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    expect(await deleteItem(id, db)).toEqual({ outcome: "deleted", imageKey: KEY_A });
    const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(rows).toHaveLength(0);
  });

  it("update, markSold, and delete report not-found for a missing id", async () => {
    const { db } = await freshDrizzle();
    expect(await updateItem(999, updateItemSchema.parse({
      title: "x", purchasePrice: 1, purchaseDate: "2026-08-23",
    }), db)).toEqual({ outcome: "not-found" });
    expect(await markItemSold(999, { sellingPrice: 1, soldDate: "2026-08-23" }, db)).toBe("not-found");
    expect(await deleteItem(999, db)).toEqual({ outcome: "not-found" });
  });
});
