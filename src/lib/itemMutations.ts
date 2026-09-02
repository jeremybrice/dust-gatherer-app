import { and, eq, isNull } from "drizzle-orm";
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

// The swipe-right action from the list. Device date, same reasoning as soldDate.
export const markPostedSchema = z.object({ postedDate: isoDate });

// Calendar scheduling: a date, or null to unschedule.
export const scheduleSchema = z.object({ scheduledPostDate: isoDate.nullable() });

export type CreateItemPayload = z.infer<typeof createItemSchema>;
export type UpdateItemPayload = z.infer<typeof updateItemSchema>;
export type MarkSoldPayload = z.infer<typeof markSoldSchema>;
export type MarkPostedPayload = z.infer<typeof markPostedSchema>;
export type SchedulePayload = z.infer<typeof scheduleSchema>;

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

export type StatusOutcome = "updated" | "not-found" | "conflict";

/**
 * Port of InventoryViewModel.markAsPosted: sets postedDate and leaves the
 * scheduled date alone (the item was scheduled, then posted; both are facts).
 * Refuses a sold item: SOLD outranks POSTED in deriveStatus, so the write would
 * be invisible in the UI while silently corrupting the history.
 */
export async function markItemPosted(
  id: number,
  payload: MarkPostedPayload,
  database?: ImportDb,
): Promise<StatusOutcome> {
  const db = database ?? (getDb() as ImportDb);
  const rows = await db
    .update(inventoryItems)
    .set({ postedDate: payload.postedDate, updatedAt: new Date() })
    .where(and(eq(inventoryItems.id, id), isNull(inventoryItems.soldDate)))
    .returning({ id: inventoryItems.id });
  if (rows.length > 0) return "updated";
  return (await exists(db, id)) ? "conflict" : "not-found";
}

/** Set or clear the scheduled post date from the calendar. Sold items are
 *  refused for the same reason as markItemPosted. */
export async function scheduleItem(
  id: number,
  payload: SchedulePayload,
  database?: ImportDb,
): Promise<StatusOutcome> {
  const db = database ?? (getDb() as ImportDb);
  const rows = await db
    .update(inventoryItems)
    .set({ scheduledPostDate: payload.scheduledPostDate, updatedAt: new Date() })
    .where(and(eq(inventoryItems.id, id), isNull(inventoryItems.soldDate)))
    .returning({ id: inventoryItems.id });
  if (rows.length > 0) return "updated";
  return (await exists(db, id)) ? "conflict" : "not-found";
}

export interface ScheduleAssignment {
  id: number;
  date: string;
}

/**
 * Auto-schedule: apply every assignment or none. Only rows that are STILL
 * unscheduled and unsold are touched, so a plan computed a moment ago cannot
 * overwrite a date she set by hand in between. Returns how many rows changed.
 */
export async function applySchedulePlan(
  plan: ScheduleAssignment[],
  database?: ImportDb,
): Promise<number> {
  const db = database ?? (getDb() as ImportDb);
  if (plan.length === 0) return 0;
  return db.transaction(async (tx) => {
    let changed = 0;
    for (const { id, date } of plan) {
      const rows = await tx
        .update(inventoryItems)
        .set({ scheduledPostDate: date, updatedAt: new Date() })
        .where(
          and(
            eq(inventoryItems.id, id),
            isNull(inventoryItems.scheduledPostDate),
            isNull(inventoryItems.soldDate),
          ),
        )
        .returning({ id: inventoryItems.id });
      changed += rows.length;
    }
    return changed;
  });
}

async function exists(db: ImportDb, id: number): Promise<boolean> {
  const rows = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id));
  return rows.length > 0;
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
