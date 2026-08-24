import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parseFilter, parseSort } from "@/lib/inventoryStats";
import AppShell from "@/components/AppShell";
import InventoryList from "@/components/InventoryList";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string; q?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const result = await listItems();

  return (
    <AppShell title="Inventory" active="inventory" addHref="/items/new">
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
        <InventoryList
          items={result.items}
          filter={parseFilter(sp.filter)}
          sort={parseSort(sp.sort)}
          q={sp.q ?? ""}
        />
      )}
    </AppShell>
  );
}
