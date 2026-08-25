import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isSignedIn } from "@/lib/auth";
import { LANG_COOKIE, parseLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "sign_in")} · ${t(lang, "app_name")}` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await isSignedIn()) redirect("/");

  // Only internal, non-protocol-relative paths — guards against an open
  // redirect through ?next=.
  const raw = (await searchParams).next;
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <LoginForm next={next} />;
}
