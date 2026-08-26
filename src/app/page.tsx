import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { parsePeriod } from "@/lib/inventoryStats";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";
import AppShell from "@/components/AppShell";
import HomeDashboard from "@/components/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSession();
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  const period = parsePeriod((await searchParams).period);
  const result = await listItems();

  return (
    <AppShell title={t(lang, "home")} active="home" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">{t(lang, "db_unconfigured")}</p>
      ) : result.status === "error" ? (
        <p className="notice">
          {t(lang, "load_error")}
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <HomeDashboard items={result.items} period={period} />
      )}
    </AppShell>
  );
}
