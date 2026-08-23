"use client";

import { zip, type AsyncZippable } from "fflate";
import type { ExportPayload } from "@/lib/exportDocument";

// The ZIP is assembled in the browser, mirroring how import unpacks there:
// a photo-laden archive is tens of megabytes, past the buffered response
// limit of a serverless function, and every network piece used here (the
// export JSON, /api/images/[key]) is already proven in production.

export interface ExportProgress {
  phase: "photos" | "zipping";
  completed: number;
  total: number;
}

export interface ExportResult {
  fileName: string;
  itemCount: number;
  /** Photos actually included in the archive. */
  photoCount: number;
  /** Photos that could not be downloaded and are MISSING from the archive. */
  errors: string[];
}

function zipAsync(files: AsyncZippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, (err, out) => (err ? reject(err) : resolve(out))),
  );
}

function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function runExport(
  onProgress: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const res = await fetch("/api/export");
  if (!res.ok) throw new Error(`Could not read the inventory (${res.status})`);
  const payload = (await res.json()) as ExportPayload;

  const files: AsyncZippable = {
    // Pretty-printed like the Android exporter's Json { prettyPrint = true }.
    "inventory.json": new TextEncoder().encode(JSON.stringify(payload.data, null, 2)),
  };

  const errors: string[] = [];
  let done = 0;
  onProgress({ phase: "photos", completed: 0, total: payload.images.length });
  for (const image of payload.images) {
    try {
      const imgRes = await fetch(`/api/images/${image.imageKey}`);
      if (!imgRes.ok) throw new Error(`download failed (${imgRes.status})`);
      // Already JPEG-compressed; level 0 stores raw instead of wasting CPU
      // deflating for a near-zero size win.
      files[`images/${image.fileName}`] = [
        new Uint8Array(await imgRes.arrayBuffer()),
        { level: 0 },
      ];
    } catch (err) {
      errors.push(`${image.fileName}: ${err instanceof Error ? err.message : "failed"}`);
    }
    onProgress({ phase: "photos", completed: ++done, total: payload.images.length });
  }

  onProgress({ phase: "zipping", completed: 0, total: 1 });
  const bytes = await zipAsync(files);

  const fileName = `dust-gatherer-backup-${localToday()}.zip`;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  return {
    fileName,
    itemCount: payload.data.items.length,
    photoCount: payload.images.length - errors.length,
    errors,
  };
}
