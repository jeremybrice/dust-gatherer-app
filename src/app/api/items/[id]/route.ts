import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { imageStore } from "@/lib/blobStore";
import { deleteItem, updateItem, updateItemSchema } from "@/lib/itemMutations";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** Best-effort blob removal, always AFTER the database write. A failure here
 *  leaves an orphaned blob, which is recoverable noise; surfacing it as a
 *  request failure would misreport a save that in fact succeeded. */
async function deleteBlobQuietly(key: string) {
  try {
    await imageStore().delete(key);
  } catch (err) {
    console.error(`could not delete blob ${key}`, err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await gateApi();
  if (gate) return gate;

  const id = parseId((await params).id);
  if (id === null) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
    return NextResponse.json(
      { error: `invalid item${where}: ${issue?.message ?? "bad request"}` },
      { status: 400 },
    );
  }

  try {
    const result = await updateItem(id, parsed.data);
    if (result.outcome === "not-found") return notFound();
    if (result.previousImageKey && result.previousImageKey !== parsed.data.imageKey) {
      await deleteBlobQuietly(result.previousImageKey);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("updateItem failed", err);
    return NextResponse.json({ error: "could not save the item" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await gateApi();
  if (gate) return gate;

  const id = parseId((await params).id);
  if (id === null) return notFound();

  try {
    const result = await deleteItem(id);
    if (result.outcome === "not-found") return notFound();
    if (result.imageKey) await deleteBlobQuietly(result.imageKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleteItem failed", err);
    return NextResponse.json({ error: "could not delete the item" }, { status: 500 });
  }
}
