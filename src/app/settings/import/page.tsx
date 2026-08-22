import type { Metadata } from "next";
import ImportWizard from "@/components/ImportWizard";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import · Dust Gatherer" };

export default async function ImportPage() {
  await requireSession();
  return <ImportWizard />;
}
