import { cookies } from "next/headers";
import ItemForm from "@/components/ItemForm";
import { requireSession } from "@/lib/auth";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";
import { listLookups } from "@/lib/lookups";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "add_item")} · ${t(lang, "app_name")}` };
}

export default async function NewItemPage() {
  await requireSession();
  const lookups = await listLookups();
  return <ItemForm item={null} categories={lookups.categories} sites={lookups.sites} />;
}
