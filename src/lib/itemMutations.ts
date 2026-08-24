import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { inventoryItems } from "@/lib/schema";
import { IMAGE_KEY_RE } from "@/lib/blobStore";
import type { ImportDb } from "@/lib/importItems";

// Payload contracts for the item CRUD routes. Validation matches the Android
// form (title non-blank, purchase price a valid number) plus the bounds the
// numeric(10,2) columns impose.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO yyyy-MM-dd date");
const money = z.number().finite().nonnegative().lt(100_000_000, "amount too large");

export const createItemSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().default(""),
  purchasePrice: money,
  sellingPrice: money.nullable().default(null),
  purchaseDate: isoDate,
  scheduledPostDate: isoDate.nullable().default(null),
  // Only a key OUR upload endpoint generated; anything else never reaches a row.
  imageKey: z.string().regex(IMAGE_KEY_RE, "not a valid image key").nullable().default(null),
  purchaseLocation: z.string().default(""),
  category: z.string().default(""),
  site: z.string().default(""),
  notes: z.string().default(""),
});

// postedDate exists only on update: the Android add screen hid the status
// dropdown, so a new item can never start life posted. soldDate is absent
// from BOTH schemas on purpose; it is written solely by markItemSold, which
// is how a regular save is prevented from un-selling or re-dating a sale.
export const updateItemSchema = createItemSchema.extend({
  postedDate: isoDate.nullable().default(null),
});

export const markSoldSchema = z.object({
  // Strictly positive, matching MarkAsSoldDialog's isValidPrice.
  sellingPrice: z.number().finite().positive().lt(100_000_000, "amount too large"),
  // The DEVICE's calendar date. The server must not compute this: its clock
  // runs UTC and would date an evening sale tomorrow.
  soldDate: isoDate,
});

export type CreateItemPayload = z.infer<typeof createItemSchema>;
export type UpdateItemPayload = z.infer<typeof updateItemSchema>;
export type MarkSoldPayload = z.infer<typeof markSoldSchema>;

// Every function takes an optional injectable db so the PGlite integration
// tests drive this exact module, same pattern as importItems.ts.

export async function createItem(
  payload: CreateItemPayload,
  database?: ImportDb,
): Promise<number> {
  const db = database ?? (getDb() as ImportDb);
  // No explicit id: the identity column assigns one, so no sequence resync.
  const [row] = await db
    .insert(inventoryItems)
    .values(payload)
    .returning({ id: inventoryItems.id });
  return row.id;
}

export type UpdateOutcome =
  | { outcome: "updated"; previousImageKey: string | null }
  | { outcome: "not-found" };

export async function updateItem(
  id: number,
  payload: UpdateItemPayload,
  database?: ImportDb,
): Promise<UpdateOutcome> {
  const db = database ?? (getDb() as ImportDb);
  const existing = await db
    .select({ imageKey: inventoryItems.imageKey })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id));
  if (existing.length === 0) return { outcome: "not-found" };

  // Deliberate departures from Android's saveItem, which rebuilt the entity
  // from scratch: createdAt is preserved (Android reset it to now on every
  // save) and soldDate is untouched (Android nulled it, silently un-selling
  // any sold item that was ever re-saved).
  await db
    .update(inventoryItems)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id));

  // The previous key lets the route delete a replaced photo's blob after the
  // row now points at the new one.
  return { outcome: "updated", previousImageKey: existing[0].imageKey };
}

export async function markItemSold(
  id: number,
  payload: MarkSoldPayload,
  database?: ImportDb,
): Promise<"updated" | "not-found"> {
  const db = database ?? (getDb() as ImportDb);
  const rows = await db
    .update(inventoryItems)
    .set({ sellingPrice: payload.sellingPrice, soldDate: payload.soldDate, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id))
    .returning({ id: inventoryItems.id });
  return rows.length > 0 ? "updated" : "not-found";
}

export type DeleteOutcome =
  | { outcome: "deleted"; imageKey: string | null }
  | { outcome: "not-found" };

export async function deleteItem(
  id: number,
  database?: ImportDb,
): Promise<DeleteOutcome> {
  const db = database ?? (getDb() as ImportDb);
  const rows = await db
    .delete(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .returning({ imageKey: inventoryItems.imageKey });
  return rows.length > 0
    ? { outcome: "deleted", imageKey: rows[0].imageKey }
    : { outcome: "not-found" };
}
