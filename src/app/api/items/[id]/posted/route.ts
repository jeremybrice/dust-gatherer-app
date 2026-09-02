import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { markItemPosted, markPostedSchema } from "@/lib/itemMutations";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await gateApi();
  if (gate) return gate;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = markPostedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `invalid request: ${parsed.error.issues[0]?.message ?? "bad request"}` },
      { status: 400 },
    );
  }

  try {
    const outcome = await markItemPosted(id, parsed.data);
    if (outcome === "not-found") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (outcome === "conflict") {
      return NextResponse.json({ error: "item is already sold" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("markItemPosted failed", err);
    return NextResponse.json({ error: "could not mark the item posted" }, { status: 500 });
  }
}
