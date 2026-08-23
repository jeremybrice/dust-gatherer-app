import type { Metadata } from "next";
import ItemForm from "@/components/ItemForm";
import { requireSession } from "@/lib/auth";
import { listLookups } from "@/lib/lookups";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add item · Dust Gatherer" };

export default async function NewItemPage() {
  await requireSession();
  const lookups = await listLookups();
  return <ItemForm item={null} categories={lookups.categories} sites={lookups.sites} />;
}
