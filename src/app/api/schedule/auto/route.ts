import { NextResponse } from "next/server";
import { z } from "zod";
import { gateApi } from "@/lib/auth";
import { applySchedulePlan } from "@/lib/itemMutations";
import { listItems } from "@/lib/items";
import { autoSchedulePlan, unscheduledItems } from "@/lib/schedule";
import { getPostingDays } from "@/lib/settings";

export const runtime = "nodejs";

// `today` is the device's calendar date, like soldDate: the server clock is
// UTC and would start the plan on tomorrow's slot for an evening tap.
const bodySchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO yyyy-MM-dd date"),
});

export async function POST(req: Request) {
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
    const [items, postingDays] = await Promise.all([listItems(), getPostingDays()]);
    if (items.status !== "ok") {
      return NextResponse.json({ error: "database unavailable" }, { status: 503 });
    }
    const plan = autoSchedulePlan(unscheduledItems(items.items), parsed.data.today, postingDays);
    const scheduled = await applySchedulePlan(plan);
    return NextResponse.json({ ok: true, scheduled });
  } catch (err) {
    console.error("auto-schedule failed", err);
    return NextResponse.json({ error: "could not auto-schedule" }, { status: 500 });
  }
}
