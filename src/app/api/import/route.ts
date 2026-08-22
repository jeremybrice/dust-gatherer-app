import { NextResponse } from "next/server";
import { z } from "zod";
import { gateApi } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { exportItemSchema } from "@/lib/exportFormat";
import { IMPORT_STRATEGIES } from "@/lib/importMapping";
import { importItemBatch, importLookups } from "@/lib/importItems";

export const runtime = "nodejs";

// One batch of items plus the image keys the client already uploaded. The
// archive is unpacked in the BROWSER and images are uploaded individually, so
// this payload stays JSON-small and never approaches the serverless request
// size limit — which a whole photo-laden ZIP would blow straight past.
const bodySchema = z.object({
  strategy: z.enum(IMPORT_STRATEGIES),
  items: z.array(exportItemSchema).max(200),
  // archive image filename -> Netlify Blobs key
  imageKeys: z.record(z.string(), z.string()).default({}),
  categories: z.array(z.string()).default([]),
  sites: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const gate = await gateApi();
  if (gate) return gate;

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "invalid request";
    return NextResponse.json({ error: message ?? "invalid request" }, { status: 400 });
  }

  try {
    if (body.categories.length || body.sites.length) {
      await importLookups(body.categories, body.sites);
    }
    const outcome = await importItemBatch(
      body.items,
      body.strategy,
      new Map(Object.entries(body.imageKeys)),
    );
    return NextResponse.json(outcome);
  } catch (err) {
    // Surface the reason: a half-finished import the user cannot diagnose is
    // worse than a clear failure they can retry.
    const message = err instanceof Error ? err.message : "import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
