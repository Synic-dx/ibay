/**
 * FEATURE: /sell, create a listing [RUBRIC:CRUD-CREATE]
 * WHO: signed-in students (the proxy and requireViewer both check).
 */
import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth/session";
import { getCategories } from "@/features/shell/queries";
import { ListingForm } from "@/features/listings/listing-form/listing-form";
import { emptyValues } from "@/features/listings/form-values";
import type { Mode } from "@/features/listings/types";

export const metadata: Metadata = { title: "List an item" };

export default async function SellPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  await requireViewer("/sell");
  const { mode } = await searchParams;
  const m = (["sell", "rent", "auction", "drop"].includes(mode ?? "") ? mode : "sell") as Mode;
  const categories = await getCategories();
  return <ListingForm key={m} categories={categories} initial={emptyValues(m) as never} />;
}
