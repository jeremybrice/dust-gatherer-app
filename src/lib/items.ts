import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { inventoryItems } from "@/lib/schema";
import { deriveProfit, deriveStatus, type ItemStatus } from "@/lib/itemStatus";

export interface InventoryItemView {
  id: number;
  title: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number | null;
  purchaseDate: string;
  scheduledPostDate: string | null;
  postedDate: string | null;
  soldDate: string | null;
  imageKey: string | null;
  purchaseLocation: string;
  category: string;
  site: string;
  notes: string;
  createdAt: string;
  status: ItemStatus;
  profit: number | null;
}

function toView(row: typeof inventoryItems.$inferSelect): InventoryItemView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    purchasePrice: row.purchasePrice,
    sellingPrice: row.sellingPrice,
    purchaseDate: row.purchaseDate,
    scheduledPostDate: row.scheduledPostDate,
    postedDate: row.postedDate,
    soldDate: row.soldDate,
    imageKey: row.imageKey,
    purchaseLocation: row.purchaseLocation,
    category: row.category,
    site: row.site,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    status: deriveStatus(row),
    profit: deriveProfit(row),
  };
}

/**
 * Newest first, matching InventoryDao.getAllItems().
 *
 * Returns a result rather than throwing: a database that is unreachable or
 * misconfigured is an operational state the page should explain, not a stack
 * trace behind an opaque "server-side exception" digest. The underlying error
 * is logged for the function logs, where it is actually diagnosable.
 */
export type ItemsResult =
  | { status: "ok"; items: InventoryItemView[] }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

export async function listItems(): Promise<ItemsResult> {
  if (!isDbConfigured()) return { status: "unconfigured" };
  try {
    const rows = await getDb()
      .select()
      .from(inventoryItems)
      .orderBy(desc(inventoryItems.createdAt));
    return { status: "ok", items: rows.map(toView) };
  } catch (err) {
    console.error("listItems failed", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

/** One item by id, or null. Throws on database failure: the page boundary
 *  converts that to notFound()/error UI, unlike the list which degrades. */
export async function getItem(id: number): Promise<InventoryItemView | null> {
  const rows = await getDb()
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id));
  return rows.length > 0 ? toView(rows[0]) : null;
}
