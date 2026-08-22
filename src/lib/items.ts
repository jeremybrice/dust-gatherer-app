import { desc } from "drizzle-orm";
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
    status: deriveStatus(row),
    profit: deriveProfit(row),
  };
}

/** Newest first, matching InventoryDao.getAllItems(). Returns null when the
 *  database is unconfigured so callers can render a setup notice. */
export async function listItems(): Promise<InventoryItemView[] | null> {
  if (!isDbConfigured()) return null;
  const rows = await getDb()
    .select()
    .from(inventoryItems)
    .orderBy(desc(inventoryItems.createdAt));
  return rows.map(toView);
}
