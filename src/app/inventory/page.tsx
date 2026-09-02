import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parseFilter, parseLimit, parseSort } from "@/lib/inventoryStats";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";
import AppShell from "@/components/AppShell";
import InventoryList from "@/components/InventoryList";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string; q?: string; limit?: string }>;
}) {
  await requireSession();
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  const sp = await searchParams;
  const result = await listItems();

  return (
    <AppShell title={t(lang, "inventory")} active="inventory" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">{t(lang, "db_unconfigured")}</p>
      ) : result.status === "error" ? (
        <p className="notice">
          {t(lang, "load_error")}
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <InventoryList
          items={result.items}
          filter={parseFilter(sp.filter)}
          sort={parseSort(sp.sort)}
          q={sp.q ?? ""}
          limit={parseLimit(sp.limit)}
        />
      )}
    </AppShell>
  );
}
