import { requireSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import LanguageRadios from "@/components/LanguageRadios";
import ThemeEditor from "@/components/ThemeEditor";
import PostingDaysEditor from "@/components/PostingDaysEditor";
import InstallPanel from "@/components/InstallPanel";
import { cookies } from "next/headers";
import { isDbConfigured } from "@/lib/db";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";
import { DEFAULT_POSTING_DAYS, getPostingDays } from "@/lib/settings";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "settings")} · ${t(lang, "app_name")}` };
}

export default async function SettingsPage() {
  await requireSession();
  const jar = await cookies();
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  // Settings must still render when the database is down or unconfigured, so
  // the posting-days block falls back to the default rather than failing the page.
  const postingDays = isDbConfigured()
    ? await getPostingDays().catch(() => [...DEFAULT_POSTING_DAYS])
    : [...DEFAULT_POSTING_DAYS];
  return (
    <AppShell title={t(lang, "settings")} active="settings">
      <LanguageRadios />
      <ThemeEditor initial={theme} />
      <PostingDaysEditor initial={postingDays} />
      <InstallPanel />
      <ul className="settings-links">
        <li>
          <a href="/settings/export">
            <h2>{t(lang, "export_data")}</h2>
            <p>{t(lang, "export_description")}</p>
          </a>
        </li>
        <li>
          <a href="/settings/import">
            <h2>{t(lang, "import_data")}</h2>
            <p>{t(lang, "import_description")}</p>
          </a>
        </li>
      </ul>
    </AppShell>
  );
}
