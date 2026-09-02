import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/schema";
import type { ImportDb } from "@/lib/importItems";

// ISO weekdays: 1 = Monday .. 7 = Sunday. Android hardcoded Mon/Wed/Fri as the
// days she posts; that stays the default until she changes it in Settings.
export const DEFAULT_POSTING_DAYS: readonly number[] = [1, 3, 5];

const POSTING_DAYS_KEY = "posting_days";

export const postingDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, "pick at least one posting day")
  .refine((days) => new Set(days).size === days.length, "duplicate posting day")
  .transform((days) => [...days].sort((a, b) => a - b));

/** Tolerant read of the stored JSON: anything malformed yields the default
 *  rather than breaking the Schedule page over one bad row. */
export function parsePostingDays(raw: string | null | undefined): number[] {
  if (!raw) return [...DEFAULT_POSTING_DAYS];
  try {
    const parsed = postingDaysSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [...DEFAULT_POSTING_DAYS];
  } catch {
    return [...DEFAULT_POSTING_DAYS];
  }
}

export async function getPostingDays(database?: ImportDb): Promise<number[]> {
  const db = database ?? (getDb() as ImportDb);
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, POSTING_DAYS_KEY));
  return parsePostingDays(rows[0]?.value);
}

export async function setPostingDays(days: number[], database?: ImportDb): Promise<number[]> {
  const db = database ?? (getDb() as ImportDb);
  const clean = postingDaysSchema.parse(days);
  await db
    .insert(appSettings)
    .values({ key: POSTING_DAYS_KEY, value: JSON.stringify(clean) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(clean), updatedAt: sql`now()` },
    });
  return clean;
}
