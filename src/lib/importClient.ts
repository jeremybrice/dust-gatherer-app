"use client";

import { unzip } from "fflate";
import { parseExportData, type ExportData } from "@/lib/exportFormat";
import { downscaleImage } from "@/lib/imageResize";
import type { ImportStrategy } from "@/lib/importMapping";

// The archive is unpacked in the browser rather than posted whole to a
// function: a photo-laden ZIP exceeds the serverless request-size limit, and
// uploading each downscaled image separately sidesteps that entirely.

const ITEM_BATCH_SIZE = 50;

export interface ParsedArchive {
  data: ExportData;
  /** archive image filename -> raw bytes */
  images: Map<string, Uint8Array>;
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, files) => (err ? reject(err) : resolve(files)));
  });
}

/** Read and validate an archive without writing anything, so the user can see
 *  what they are about to import. Mirrors DataImporter.previewImport. */
export async function parseArchive(file: File): Promise<ParsedArchive> {
  const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));

  const manifestBytes = files["inventory.json"];
  if (!manifestBytes) {
    throw new Error("Invalid backup file: inventory.json not found");
  }
  const data = parseExportData(JSON.parse(new TextDecoder().decode(manifestBytes)));

  const images = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith("images/") && !path.endsWith("/") && bytes.length > 0) {
      images.set(path.slice("images/".length), bytes);
    }
  }
  return { data, images };
}

export interface ImportProgress {
  phase: "images" | "items";
  completed: number;
  total: number;
}

export interface RunImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Upload images, then post items in batches.
 *
 * An image that fails to upload does not abort the run — the item is still
 * imported, without its picture, and the failure is reported. Losing one photo
 * is far better than losing the inventory record it belonged to.
 */
export async function runImport(
  archive: ParsedArchive,
  strategy: ImportStrategy,
  onProgress: (p: ImportProgress) => void,
): Promise<RunImportResult> {
  const errors: string[] = [];
  const imageKeys: Record<string, string> = {};

  // Only upload images an item actually references.
  const referenced = new Set(
    archive.data.items.map((i) => i.imageFileName).filter((n): n is string => !!n),
  );
  const toUpload = [...archive.images].filter(([name]) => referenced.has(name));

  let done = 0;
  onProgress({ phase: "images", completed: 0, total: toUpload.length });
  for (const [name, bytes] of toUpload) {
    try {
      // Copy into a fresh buffer: fflate returns views onto a shared buffer,
      // and Blob() would otherwise capture the whole archive per image.
      const source = new Blob([new Uint8Array(bytes)]);
      const downscaled = await downscaleImage(source);
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: downscaled,
      });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
      imageKeys[name] = (await res.json()).key;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : "image failed"}`);
    }
    onProgress({ phase: "images", completed: ++done, total: toUpload.length });
  }

  const items = archive.data.items;
  let imported = 0;
  let skipped = 0;
  onProgress({ phase: "items", completed: 0, total: items.length });

  for (let i = 0; i < items.length; i += ITEM_BATCH_SIZE) {
    const batch = items.slice(i, i + ITEM_BATCH_SIZE);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy,
        items: batch,
        imageKeys,
        // Send the lookup lists once, with the first batch.
        categories: i === 0 ? archive.data.categories : [],
        sites: i === 0 ? archive.data.sites : [],
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error ?? `Import failed at item ${i + 1}`);
    }
    const outcome = await res.json();
    imported += outcome.imported ?? 0;
    skipped += outcome.skipped ?? 0;
    onProgress({ phase: "items", completed: Math.min(i + batch.length, items.length), total: items.length });
  }

  return { imported, skipped, errors };
}
