import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { imageStore, newImageKey } from "@/lib/blobStore";

export const runtime = "nodejs";

// Images arrive already downscaled by the browser (see imageResize.ts), so this
// ceiling is a guard against a malformed or hostile upload, not the normal path.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const gate = await gateApi();
  if (gate) return gate;

  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: "unsupported image type" }, { status: 415 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "empty upload" }, { status: 400 });
  }
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  try {
    const key = newImageKey();
    await imageStore().set(key, body, { metadata: { contentType } });
    return NextResponse.json({ key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
