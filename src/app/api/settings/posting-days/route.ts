import { NextResponse } from "next/server";
import { z } from "zod";
import { gateApi } from "@/lib/auth";
import { postingDaysSchema, setPostingDays } from "@/lib/settings";

export const runtime = "nodejs";

const bodySchema = z.object({ postingDays: postingDaysSchema });

export async function PUT(req: Request) {
  const gate = await gateApi();
  if (gate) return gate;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `invalid request: ${parsed.error.issues[0]?.message ?? "bad request"}` },
      { status: 400 },
    );
  }

  try {
    const postingDays = await setPostingDays(parsed.data.postingDays);
    return NextResponse.json({ ok: true, postingDays });
  } catch (err) {
    console.error("setPostingDays failed", err);
    return NextResponse.json({ error: "could not save posting days" }, { status: 500 });
  }
}
