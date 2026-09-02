import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDrizzle } from "../helpers/pg";
import { inventoryItems } from "@/lib/schema";
import {
  applySchedulePlan,
  createItem,
  createItemSchema,
  deleteItem,
  markItemPosted,
  markItemSold,
  scheduleItem,
  updateItem,
  updateItemSchema,
} from "@/lib/itemMutations";
import { DEFAULT_POSTING_DAYS, getPostingDays, setPostingDays } from "@/lib/settings";

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

describe("list status actions over PGlite", () => {
  it("markItemPosted sets postedDate and keeps the scheduled date", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(
      createItemSchema.parse({ ...basePayload(), scheduledPostDate: "2026-09-10" }),
      db,
    );
    expect(await markItemPosted(id, { postedDate: "2026-09-10" }, db)).toBe("updated");
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.postedDate).toBe("2026-09-10");
    expect(row.scheduledPostDate).toBe("2026-09-10");
  });

  it("markItemPosted and scheduleItem refuse a sold item and report a missing one", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    await markItemSold(id, { sellingPrice: 30, soldDate: "2026-08-25" }, db);
    expect(await markItemPosted(id, { postedDate: "2026-09-01" }, db)).toBe("conflict");
    expect(await scheduleItem(id, { scheduledPostDate: "2026-09-01" }, db)).toBe("conflict");
    expect(await markItemPosted(999, { postedDate: "2026-09-01" }, db)).toBe("not-found");
    expect(await scheduleItem(999, { scheduledPostDate: null }, db)).toBe("not-found");
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.postedDate).toBeNull();
    expect(row.scheduledPostDate).toBeNull();
  });

  it("scheduleItem sets and clears the scheduled date", async () => {
    const { db } = await freshDrizzle();
    const id = await createItem(basePayload(), db);
    expect(await scheduleItem(id, { scheduledPostDate: "2026-09-12" }, db)).toBe("updated");
    let [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.scheduledPostDate).toBe("2026-09-12");
    expect(await scheduleItem(id, { scheduledPostDate: null }, db)).toBe("updated");
    [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row.scheduledPostDate).toBeNull();
  });

  it("applySchedulePlan only touches rows still unscheduled and unsold", async () => {
    const { db } = await freshDrizzle();
    const a = await createItem(basePayload(), db);
    const b = await createItem(basePayload(), db);
    const c = await createItem(basePayload(), db);
    await scheduleItem(b, { scheduledPostDate: "2026-09-01" }, db);
    await markItemSold(c, { sellingPrice: 9, soldDate: "2026-08-30" }, db);

    const changed = await applySchedulePlan(
      [
        { id: a, date: "2026-09-14" },
        { id: b, date: "2026-09-16" },
        { id: c, date: "2026-09-18" },
        { id: 999, date: "2026-09-21" },
      ],
      db,
    );
    expect(changed).toBe(1);
    const rows = await db.select().from(inventoryItems).orderBy(inventoryItems.id);
    expect(rows.map((r) => r.scheduledPostDate)).toEqual(["2026-09-14", "2026-09-01", null]);
    expect(await applySchedulePlan([], db)).toBe(0);
  });
});

describe("posting days over PGlite", () => {
  it("defaults to Mon/Wed/Fri and round-trips a change", async () => {
    const { db } = await freshDrizzle();
    expect(await getPostingDays(db)).toEqual([...DEFAULT_POSTING_DAYS]);
    expect(await setPostingDays([6, 2], db)).toEqual([2, 6]);
    expect(await getPostingDays(db)).toEqual([2, 6]);
    expect(await setPostingDays([7], db)).toEqual([7]);
    expect(await getPostingDays(db)).toEqual([7]);
  });

  it("rejects an empty list, duplicates, and out-of-range days", async () => {
    const { db } = await freshDrizzle();
    await expect(setPostingDays([], db)).rejects.toThrow();
    await expect(setPostingDays([1, 1], db)).rejects.toThrow();
    await expect(setPostingDays([0], db)).rejects.toThrow();
    await expect(setPostingDays([8], db)).rejects.toThrow();
  });
});
