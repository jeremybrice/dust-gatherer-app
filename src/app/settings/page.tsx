import { requireSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import LanguageRadios from "@/components/LanguageRadios";
import InstallPanel from "@/components/InstallPanel";
import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "settings")} · ${t(lang, "app_name")}` };
}

export default async function SettingsPage() {
  await requireSession();
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <AppShell title={t(lang, "settings")} active="settings">
      <LanguageRadios />
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
