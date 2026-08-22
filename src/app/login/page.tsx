import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isSignedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Dust Gatherer" };

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
