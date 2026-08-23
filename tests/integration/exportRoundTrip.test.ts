import { describe, expect, it } from "vitest";
import { freshDrizzle } from "../helpers/pg";
import { inventoryItems } from "@/lib/schema";
import { createItem, createItemSchema, markItemSold } from "@/lib/itemMutations";
import { buildExportPayload } from "@/lib/exportDocument";
import { parseExportData } from "@/lib/exportFormat";
import { importItemBatch } from "@/lib/importItems";

const KEY = "0123456789abcdef0123456789abcdef";

// The safety property from the spec: an exported document re-imported into a
// fresh database reproduces the inventory exactly, ids included.
describe("export round trip", () => {
  it("reimporting an export reproduces the rows", async () => {
    const { db: source } = await freshDrizzle();
    const soldId = await createItem(
      createItemSchema.parse({
        title: "Brass lamp",
        description: "Mid-century",
        purchasePrice: 12.5,
        sellingPrice: 30,
        purchaseDate: "2026-08-01",
        imageKey: KEY,
        purchaseLocation: "Goodwill",
        category: "Lighting",
        site: "Etsy",
        notes: "small dent",
      }),
      source,
    );
    await markItemSold(soldId, { sellingPrice: 42.75, soldDate: "2026-08-20" }, source);
    await createItem(
      createItemSchema.parse({
        title: "Plain item",
        purchasePrice: 3,
        purchaseDate: "2026-08-15",
        scheduledPostDate: "2026-09-01",
      }),
      source,
    );

    const originals = await source.select().from(inventoryItems).orderBy(inventoryItems.id);
    const payload = buildExportPayload(originals, ["Lighting"], ["Etsy"], "2026-08-23T12:00:00");

    // Simulate the wire and the file: stringify, parse, validate.
    const parsed = parseExportData(JSON.parse(JSON.stringify(payload.data)));

    // On restore the photo is re-uploaded and gets a key; identity map here.
    const imageKeys = new Map(payload.images.map((i) => [i.fileName, i.imageKey]));

    const { db: restored } = await freshDrizzle();
    const outcome = await importItemBatch(parsed.items, "SKIP_EXISTING", imageKeys, restored);
    expect(outcome).toEqual({ imported: 2, skipped: 0 });

    const copies = await restored.select().from(inventoryItems).orderBy(inventoryItems.id);
    expect(copies).toHaveLength(originals.length);
    for (let i = 0; i < originals.length; i++) {
      const a = originals[i];
      const b = copies[i];
      expect(b.id).toBe(a.id);
      expect(b.title).toBe(a.title);
      expect(b.purchasePrice).toBe(a.purchasePrice);
      expect(b.sellingPrice).toBe(a.sellingPrice);
      expect(b.purchaseDate).toBe(a.purchaseDate);
      expect(b.scheduledPostDate).toBe(a.scheduledPostDate);
      expect(b.postedDate).toBe(a.postedDate);
      expect(b.soldDate).toBe(a.soldDate);
      expect(b.imageKey).toBe(a.imageKey);
      expect(b.category).toBe(a.category);
      expect(b.site).toBe(a.site);
      expect(b.notes).toBe(a.notes);
      expect(b.createdAt.getTime()).toBe(a.createdAt.getTime());
    }
  });
});
