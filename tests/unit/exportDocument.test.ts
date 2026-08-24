import { describe, expect, it } from "vitest";
import { buildExportPayload } from "@/lib/exportDocument";
import { parseExportData } from "@/lib/exportFormat";
import type { InventoryItemRow } from "@/lib/schema";

const KEY = "0123456789abcdef0123456789abcdef";

function row(overrides: Partial<InventoryItemRow> = {}): InventoryItemRow {
  return {
    id: 7,
    title: "Brass lamp",
    description: "Mid-century",
    purchasePrice: 12.5,
    sellingPrice: 40,
    purchaseDate: "2026-08-01",
    scheduledPostDate: null,
    postedDate: "2026-08-10",
    soldDate: "2026-08-20",
    imageKey: KEY,
    purchaseLocation: "Goodwill",
    category: "Lighting",
    site: "Etsy",
    notes: "",
    createdAt: new Date(1700000000000),
    updatedAt: new Date(1700000001000),
    ...overrides,
  };
}

describe("buildExportPayload", () => {
  it("writes the manifest explicitly at version 2", () => {
    const { data } = buildExportPayload([row()], [], [], "2026-08-23T12:00:00");
    expect(data.manifest.version).toBe(2);
    expect(data.manifest.itemCount).toBe(1);
    expect(data.manifest.exportDate).toBe("2026-08-23T12:00:00");
  });

  it("derives imageFileName from the blob key and lists the image", () => {
    const { data, images } = buildExportPayload(
      [row(), row({ id: 8, imageKey: null })],
      [],
      [],
      "2026-08-23T12:00:00",
    );
    expect(data.items[0].imageFileName).toBe(`${KEY}.jpg`);
    expect(data.items[1].imageFileName).toBeNull();
    expect(images).toEqual([{ fileName: `${KEY}.jpg`, imageKey: KEY }]);
  });

  it("converts timestamps to epoch milliseconds", () => {
    const { data } = buildExportPayload([row()], [], [], "2026-08-23T12:00:00");
    expect(data.items[0].createdAt).toBe(1700000000000);
    expect(data.items[0].updatedAt).toBe(1700000001000);
  });

  it("survives a JSON round trip through the importer's parser", () => {
    const { data } = buildExportPayload(
      [row()],
      ["Lighting"],
      ["Etsy"],
      "2026-08-23T12:00:00",
    );
    const parsed = parseExportData(JSON.parse(JSON.stringify(data)));
    expect(parsed.items[0]).toEqual(data.items[0]);
    expect(parsed.categories).toEqual(["Lighting"]);
    expect(parsed.sites).toEqual(["Etsy"]);
  });
});
