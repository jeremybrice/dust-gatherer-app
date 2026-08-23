import { describe, it, expect } from "vitest";
import {
  parseExportData, ExportFormatError, NEWER_VERSION_MESSAGE, CURRENT_EXPORT_VERSION,
} from "@/lib/exportFormat";

// Shaped exactly as DataExporter.exportToZip writes it.
const v2 = {
  manifest: { version: 2, appVersion: "1.0", exportDate: "2026-08-01T10:00:00", itemCount: 1 },
  items: [{
    id: 7, title: "Brass lamp", description: "small chip", purchasePrice: 12.5,
    sellingPrice: 40, purchaseDate: "2026-01-15", scheduledPostDate: null,
    postedDate: "2026-02-01", soldDate: null, imageFileName: "lamp.jpg",
    purchaseLocation: "Goodwill", category: "Lighting", site: "Etsy",
    notes: "", createdAt: 1737000000000, updatedAt: 1738000000000,
  }],
  categories: ["Lighting"],
  sites: ["Etsy"],
};

describe("parseExportData", () => {
  it("accepts a version 2 archive and preserves every field", () => {
    const data = parseExportData(v2);
    expect(data.items[0].title).toBe("Brass lamp");
    expect(data.items[0].site).toBe("Etsy");
    expect(data.items[0].sellingPrice).toBe(40);
    expect(data.items[0].postedDate).toBe("2026-02-01");
  });

  // `site` arrived in version 2; a version 1 archive omits it entirely.
  it("accepts a version 1 archive, defaulting the fields it predates", () => {
    const { site, ...withoutSite } = v2.items[0];
    const data = parseExportData({
      manifest: { version: 1 }, items: [withoutSite], categories: [], sites: [],
    });
    expect(data.items[0].site).toBe("");
  });

  // kotlinx.serialization leaves encodeDefaults false, so the Android exporter
  // omits every property equal to its declared default. ExportManifest.version
  // defaults to CURRENT_EXPORT_VERSION and is therefore NEVER written — a real
  // backup has no version field at all. Requiring it rejected every genuine
  // archive with "Invalid input".
  it("accepts a manifest with no version field, as the exporter actually writes it", () => {
    const data = parseExportData({
      manifest: { appVersion: "1.0", exportDate: "2026-08-01T10:00:00", itemCount: 1 },
      items: [v2.items[0]],
    });
    expect(data.manifest.version).toBe(CURRENT_EXPORT_VERSION);
    expect(data.items[0].title).toBe("Brass lamp");
  });

  // Same omission rule: an item with no site, and empty category/site lists.
  it("accepts an archive with every defaulted field omitted", () => {
    const { site, ...noSite } = v2.items[0];
    const data = parseExportData({
      manifest: { appVersion: "1.0", exportDate: "2026-08-01T10:00:00", itemCount: 1 },
      items: [noSite],
    });
    expect(data.items[0].site).toBe("");
    expect(data.categories).toEqual([]);
    expect(data.sites).toEqual([]);
  });

  // A vague failure turns a one-line schema fix into a guessing game.
  it("names the field that failed validation", () => {
    expect(() => parseExportData({
      manifest: {}, items: [{ ...v2.items[0], purchasePrice: "twelve" }],
    })).toThrow(/items\.0\.purchasePrice/);
  });

  // Dropping fields we do not understand would silently lose the user's data.
  it("refuses an archive from a newer app version", () => {
    expect(() => parseExportData({ ...v2, manifest: { version: CURRENT_EXPORT_VERSION + 1 } }))
      .toThrow(NEWER_VERSION_MESSAGE);
  });

  it("rejects malformed documents", () => {
    expect(() => parseExportData({ items: [] })).toThrow(ExportFormatError);
    expect(() => parseExportData(null)).toThrow(ExportFormatError);
    // A date in the wrong format would silently corrupt the lifecycle.
    expect(() => parseExportData({
      ...v2, items: [{ ...v2.items[0], purchaseDate: "15/01/2026" }],
    })).toThrow(/ISO/);
  });
});
