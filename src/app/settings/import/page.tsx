import { cookies } from "next/headers";
import ImportWizard from "@/components/ImportWizard";
import { requireSession } from "@/lib/auth";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "import_heading")} · ${t(lang, "app_name")}` };
}

export default async function ImportPage() {
  await requireSession();
  return <ImportWizard />;
}
