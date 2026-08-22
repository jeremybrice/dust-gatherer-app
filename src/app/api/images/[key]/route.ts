import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { IMAGE_KEY_RE, imageStore } from "@/lib/blobStore";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await gateApi();
  if (gate) return gate;

  const { key } = await params;
  // Reject anything that is not a generated key before touching the store.
  if (!IMAGE_KEY_RE.test(key)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await imageStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });

  const contentType =
    typeof result.metadata?.contentType === "string" ? result.metadata.contentType : "image/jpeg";

  return new NextResponse(result.data as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      // Content is immutable: a key always denotes the same bytes, and a new
      // image gets a new key. `private` keeps it out of shared caches, since
      // the bytes sit behind the session gate.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
