import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parsePeriod } from "@/lib/inventoryStats";
import AppShell from "@/components/AppShell";
import HomeDashboard from "@/components/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const period = parsePeriod((await searchParams).period);
  const result = await listItems();

  return (
    <AppShell title="Home" active="home" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">
          The database is not configured yet. Set <code>NETLIFY_DB_URL</code> and apply
          migrations, then reload.
        </p>
      ) : result.status === "error" ? (
        <p className="notice">
          The inventory could not be loaded. The database reported:
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <HomeDashboard items={result.items} period={period} />
      )}
    </AppShell>
  );
}
