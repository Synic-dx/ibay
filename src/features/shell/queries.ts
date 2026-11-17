/**
 * FEATURE: Data for the app shell (header, category bar, LIVE ticker, badges)
 * WHAT: Categories and collections for the menus, live food drops and auctions
 *       for the ticker, and the unread/saved counters on the header icons.
 */
import "server-only";
import { cache } from "react";
import { db, dbReady } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/session";
import { CARD_SELECT, mapCard } from "@/features/listings/queries";
import type { ListingCard } from "@/features/listings/types";

export type Category = { id: string; name: string; short: string; group: string; description: string; icon: string; cover: string | null; coverFit: "contain" | "cover" };
export type Collection = { id: string; name: string; description: string; rule: { tags_any?: string[]; categories?: string[]; exclude_tags?: string[] } };

export const GROUPS = ["Seasons", "Study", "Hostel life", "Play"] as const;
export const GROUP_ICON: Record<string, string> = { Seasons: "cal", Study: "grad", "Hostel life": "bed", Play: "trophy" };

/** All categories in display order (cached per request). */
export const getCategories = cache(async (): Promise<Category[]> => {
  if (!dbReady()) return [];
  const { data } = await db().from("categories").select("*").order("sort");
  return (data ?? []).map((c) => ({
    id: c.id, name: c.name, short: c.short_name, group: c.group, description: c.description, icon: c.icon, cover: c.cover_url, coverFit: c.cover_fit,
  }));
});

/** Shop-by-moment collections. */
export const getCollections = cache(async (): Promise<Collection[]> => {
  if (!dbReady()) return [];
  const { data } = await db().from("collections").select("*").order("sort");
  return (data ?? []) as Collection[];
});

/** Does a listing belong to a collection (same rule as the SQL browse function)? */
export function inCollection(l: Pick<ListingCard, "tags" | "categoryId">, c: Collection): boolean {
  if (c.rule.tags_any) return l.tags.some((t) => c.rule.tags_any!.includes(t));
  if (c.rule.categories) return c.rule.categories.includes(l.categoryId) && !l.tags.some((t) => (c.rule.exclude_tags ?? []).includes(t));
  return false;
}

export type LiveItems = { drops: ListingCard[]; auctions: ListingCard[]; allDrops: number };

/**
 * Food drops (only the viewer's hostel) and auctions that are still running,
 * soonest first. Guests see auctions and a count of drops.
 */
export const getLiveItems = cache(async (viewer: Viewer | null): Promise<LiveItems> => {
  if (!dbReady()) return { drops: [], auctions: [], allDrops: 0 };
  const { data } = await db()
    .from("listings")
    .select(CARD_SELECT)
    .in("mode", ["drop", "auction"])
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .limit(60);
  const cards = (data ?? []).filter((r) => !r.seller?.banned).map((r) => mapCard(r));
  const allD = cards.filter((c) => c.mode === "drop" && c.seller.id !== viewer?.id);
  return {
    drops: viewer ? allD.filter((c) => c.pickupHostel === viewer.hostel) : [],
    auctions: cards.filter((c) => c.mode === "auction"),
    allDrops: allD.length,
  };
});

/** Unread chats, unread notifications and saved items for the header badges. */
export const getCounts = cache(async (viewer: Viewer | null) => {
  if (!viewer) return { unreadChats: 0, unreadNotifs: 0, saved: 0 };
  const { data: convs } = await db().from("conversations").select("id").or(`user_a.eq.${viewer.id},user_b.eq.${viewer.id}`);
  const ids = (convs ?? []).map((c) => c.id);
  const [chats, notifs, saved] = await Promise.all([
    ids.length
      ? db().from("messages").select("id", { count: "exact", head: true }).in("conversation_id", ids).neq("sender_id", viewer.id).is("read_at", null)
      : Promise.resolve({ count: 0 }),
    db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).is("read_at", null),
    db().from("saved_items").select("listing_id", { count: "exact", head: true }).eq("user_id", viewer.id),
  ]);
  return { unreadChats: chats.count ?? 0, unreadNotifs: notifs.count ?? 0, saved: saved.count ?? 0 };
});
