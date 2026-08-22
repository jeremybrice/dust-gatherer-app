import { z } from "zod";

// Contract for the backup archive produced by the Android app's
// DataExporter.exportToZip, and by this app's own export. Faithful port of
// ExportModels.kt — field names and types must match exactly or existing
// backups stop loading.
//
// Archive layout:
//   inventory.json      the ExportData document below
//   images/<filename>   one file per item that has an image

export const CURRENT_EXPORT_VERSION = 2;

/** ISO_LOCAL_DATE, as written by Kotlin's DateTimeFormatter.ISO_LOCAL_DATE. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO yyyy-MM-dd date");

export const exportManifestSchema = z.object({
  version: z.number().int(),
  appVersion: z.string().optional(),
  exportDate: z.string().optional(),
  itemCount: z.number().int().optional(),
});

export const exportItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().default(""),
  purchasePrice: z.number(),
  sellingPrice: z.number().nullable().default(null),
  purchaseDate: isoDate,
  scheduledPostDate: isoDate.nullable().default(null),
  postedDate: isoDate.nullable().default(null),
  soldDate: isoDate.nullable().default(null),
  imageFileName: z.string().nullable().default(null),
  purchaseLocation: z.string().default(""),
  category: z.string().default(""),
  // `site` was added in export version 2; version 1 archives omit it.
  site: z.string().default(""),
  notes: z.string().default(""),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const exportDataSchema = z.object({
  manifest: exportManifestSchema,
  items: z.array(exportItemSchema),
  categories: z.array(z.string()).default([]),
  sites: z.array(z.string()).default([]),
});

export type ExportManifest = z.infer<typeof exportManifestSchema>;
export type ExportItem = z.infer<typeof exportItemSchema>;
export type ExportData = z.infer<typeof exportDataSchema>;

/** Message the Android importer shows for a too-new archive; kept identical so
 *  the two apps explain the same failure the same way. */
export const NEWER_VERSION_MESSAGE =
  "Backup was created with a newer app version. Please update the app.";

export class ExportFormatError extends Error {}

/**
 * Parse and validate an inventory.json document.
 *
 * Rejects an archive from a FUTURE version rather than silently dropping the
 * fields it does not understand — mirroring DataImporter.previewImport.
 * Older versions are accepted: missing fields fall back to their defaults.
 */
export function parseExportData(json: unknown): ExportData {
  const parsed = exportDataSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExportFormatError(`Invalid backup file: ${parsed.error.issues[0]?.message ?? "unrecognised format"}`);
  }
  if (parsed.data.manifest.version > CURRENT_EXPORT_VERSION) {
    throw new ExportFormatError(NEWER_VERSION_MESSAGE);
  }
  return parsed.data;
}
