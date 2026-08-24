import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, sites } from "@/lib/schema";
import type { ImportDb } from "@/lib/importItems";

/** Category and site names for the form dropdowns and the export document.
 *  Alphabetical, matching the Android settings screens' ordering. */
export async function listLookups(
  database?: ImportDb,
): Promise<{ categories: string[]; sites: string[] }> {
  const db = database ?? (getDb() as ImportDb);
  const [cats, sts] = await Promise.all([
    db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ name: sites.name }).from(sites).orderBy(asc(sites.name)),
  ]);
  return { categories: cats.map((r) => r.name), sites: sts.map((r) => r.name) };
}
