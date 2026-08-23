import type { Metadata } from "next";
import ExportPanel from "@/components/ExportPanel";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Export · Dust Gatherer" };

export default async function ExportPage() {
  await requireSession();
  return <ExportPanel />;
}
