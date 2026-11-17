"use server";
/**
 * FEATURE: Search-as-you-type suggestions (phone search screen)
 * WHAT: Matching categories and the top 8 listings for what you have typed.
 */
import { browseListings } from "@/features/listings/queries";
import { getCategories } from "@/features/shell/queries";
import { getViewer } from "@/lib/auth/session";
import type { ListingCard } from "@/features/listings/types";

export async function suggest(q: string): Promise<{ cats: { id: string; name: string; icon: string }[]; items: ListingCard[] }> {
  const v = q.trim().slice(0, 80);
  if (!v) return { cats: [], items: [] };
  const viewer = await getViewer();
  const [cats, { items }] = await Promise.all([getCategories(), browseListings({ q: v, limit: 8 }, viewer)]);
  return {
    cats: cats.filter((c) => c.name.toLowerCase().includes(v.toLowerCase())).map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    items,
  };
}
