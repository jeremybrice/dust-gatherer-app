import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ItemForm from "@/components/ItemForm";
import { requireSession } from "@/lib/auth";
import { getItem } from "@/lib/items";
import { listLookups } from "@/lib/lookups";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit item · Dust Gatherer" };

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const raw = (await params).id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [item, lookups] = await Promise.all([getItem(id), listLookups()]);
  if (!item) notFound();

  return <ItemForm item={item} categories={lookups.categories} sites={lookups.sites} />;
}
