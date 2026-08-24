import { describe, expect, it } from "vitest";
import { zip, unzip, type AsyncZippable } from "fflate";
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

function zipAsync(files: AsyncZippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, (err, out) => (err ? reject(err) : resolve(out))),
  );
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) =>
    unzip(bytes, (err, out) => (err ? reject(err) : resolve(out))),
  );
}

// Nothing else proves a ZIP written the way runExport writes it is actually
// readable by importClient's unzip path. This duplicates the two-line file
// assembly from exportClient.ts on purpose: exportClient can't be imported
// here ("use client", DOM APIs), so this test doubles as documentation of the
// wire format both sides must agree on.
describe("export archive wire format", () => {
  it("round trips inventory.json and photo bytes through zip/unzip", async () => {
    const payload = buildExportPayload(
      [row(), row({ id: 8, imageKey: null })],
      ["Lighting"],
      ["Etsy"],
      "2026-08-23T12:00:00",
    );

    const fakeBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const files: AsyncZippable = {
      "inventory.json": new TextEncoder().encode(JSON.stringify(payload.data, null, 2)),
    };
    for (const image of payload.images) {
      files[`images/${image.fileName}`] = [fakeBytes, { level: 0 }];
    }

    const zipped = await zipAsync(files);
    const unzipped = await unzipAsync(zipped);

    const manifestBytes = unzipped["inventory.json"];
    expect(manifestBytes).toBeDefined();
    const parsed = parseExportData(JSON.parse(new TextDecoder().decode(manifestBytes)));
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].imageFileName).toBe(`${KEY}.jpg`);
    expect(parsed.items[1].imageFileName).toBeNull();

    expect(payload.images).toHaveLength(1);
    for (const image of payload.images) {
      const entry = unzipped[`images/${image.fileName}`];
      expect(entry).toBeDefined();
      expect(entry.length).toBeGreaterThan(0);
      expect(entry).toEqual(fakeBytes);

      // Mirrors importClient.parseArchive's filter and keying: images/ paths
      // with non-empty bytes survive, and get keyed by the bare filename.
      const strippedName = image.fileName;
      expect(entry.length > 0).toBe(true);
      expect(`images/${strippedName}`.slice("images/".length)).toBe(image.fileName);
    }
  });
});
