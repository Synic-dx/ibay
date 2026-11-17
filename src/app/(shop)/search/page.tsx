/** FEATURE: Phone search page (desktop uses the header search). */
import type { Metadata } from "next";
import { getCategories } from "@/features/shell/queries";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const cats = await getCategories();
  return <SearchView initial={q ?? ""} categories={cats.map((c) => ({ id: c.id, name: c.name, description: c.description, icon: c.icon }))} />;
}
