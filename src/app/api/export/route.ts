import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { gateApi } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inventoryItems } from "@/lib/schema";
import { listLookups } from "@/lib/lookups";
import { buildExportPayload } from "@/lib/exportDocument";

export const runtime = "nodejs";

export async function GET() {
  const gate = await gateApi();
  if (gate) return gate;

  try {
    const [rows, lookups] = await Promise.all([
      getDb().select().from(inventoryItems).orderBy(asc(inventoryItems.id)),
      listLookups(),
    ]);
    // Informational only; ISO_LOCAL_DATE_TIME shaped like the Android manifest.
    const exportDate = new Date().toISOString().slice(0, 19);
    return NextResponse.json(
      buildExportPayload(rows, lookups.categories, lookups.sites, exportDate),
    );
  } catch (err) {
    console.error("export failed", err);
    return NextResponse.json({ error: "could not read the inventory" }, { status: 500 });
  }
}
