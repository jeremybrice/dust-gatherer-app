import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { markItemSold, markSoldSchema } from "@/lib/itemMutations";

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
  const parsed = markSoldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `invalid sale: ${parsed.error.issues[0]?.message ?? "bad request"}` },
      { status: 400 },
    );
  }

  try {
    const outcome = await markItemSold(id, parsed.data);
    if (outcome === "not-found") return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("markItemSold failed", err);
    return NextResponse.json({ error: "could not record the sale" }, { status: 500 });
  }
}
