import { NextResponse } from "next/server";
import { gateApi } from "@/lib/auth";
import { createItem, createItemSchema } from "@/lib/itemMutations";

export const runtime = "nodejs";

function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  const issue = issues[0];
  const where = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
  return NextResponse.json(
    { error: `invalid item${where}: ${issue?.message ?? "bad request"}` },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const gate = await gateApi();
  if (gate) return gate;

  const body = await req.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues);

  try {
    const id = await createItem(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("createItem failed", err);
    return NextResponse.json({ error: "could not save the item" }, { status: 500 });
  }
}
