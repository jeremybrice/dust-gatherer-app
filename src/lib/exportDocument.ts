import {
  CURRENT_EXPORT_VERSION,
  type ExportData,
  type ExportItem,
} from "@/lib/exportFormat";
import type { InventoryItemRow } from "@/lib/schema";

export interface ExportImageRef {
  fileName: string;
  imageKey: string;
}

export interface ExportPayload {
  data: ExportData;
  /** What the client must fetch and zip under images/. */
  images: ExportImageRef[];
}

/** Archives carry filenames, not blob keys; the key doubles as a stable
 *  filename. All photos are JPEG after imageResize.ts. */
export function imageFileNameFor(imageKey: string): string {
  return `${imageKey}.jpg`;
}

/**
 * Build the inventory.json document plus the list of photos to include.
 *
 * Every field is written EXPLICITLY, version included. The reader
 * (exportFormat.ts) uses an absent version to identify an Android-written
 * archive, so exports written here must always emit it. This intentionally
 * does not imitate kotlinx.serialization's omission of default values.
 */
export function buildExportPayload(
  rows: InventoryItemRow[],
  categoryNames: string[],
  siteNames: string[],
  exportDate: string,
): ExportPayload {
  const items: ExportItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    purchasePrice: row.purchasePrice,
    sellingPrice: row.sellingPrice,
    purchaseDate: row.purchaseDate,
    scheduledPostDate: row.scheduledPostDate,
    postedDate: row.postedDate,
    soldDate: row.soldDate,
    imageFileName: row.imageKey ? imageFileNameFor(row.imageKey) : null,
    purchaseLocation: row.purchaseLocation,
    category: row.category,
    site: row.site,
    notes: row.notes,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));

  const images: ExportImageRef[] = rows.flatMap((row) =>
    row.imageKey ? [{ fileName: imageFileNameFor(row.imageKey), imageKey: row.imageKey }] : [],
  );

  return {
    data: {
      manifest: {
        version: CURRENT_EXPORT_VERSION,
        appVersion: "dust-gatherer-web",
        exportDate,
        itemCount: items.length,
      },
      items,
      categories: categoryNames,
      sites: siteNames,
    },
    images,
  };
}
