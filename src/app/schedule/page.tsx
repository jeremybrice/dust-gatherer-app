import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/items";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";
import { getPostingDays } from "@/lib/settings";
import AppShell from "@/components/AppShell";
import ScheduleView from "@/components/ScheduleView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "schedule")} · ${t(lang, "app_name")}` };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  await requireSession();
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  const sp = await searchParams;
  const result = await listItems();
  // Month and day are parsed on the client against the DEVICE's today (the
  // server clock is UTC), so only the raw params travel from here.
  const postingDays = result.status === "ok" ? await getPostingDays() : [];

  return (
    <AppShell title={t(lang, "schedule")} active="schedule" addHref="/items/new">
      {result.status === "unconfigured" ? (
        <p className="notice">{t(lang, "db_unconfigured")}</p>
      ) : result.status === "error" ? (
        <p className="notice">
          {t(lang, "load_error")}
          <br />
          <code>{result.message}</code>
        </p>
      ) : (
        <ScheduleView
          items={result.items}
          postingDays={postingDays}
          monthParam={sp.month}
          dayParam={sp.day}
        />
      )}
    </AppShell>
  );
}
