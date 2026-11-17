/**
 * FEATURE: My listings data [RUBRIC:CRUD-READ] [RUBRIC:DATA-DISPLAY]
 * WHAT: The owner's listings for one status tab, filtered by mode, category
 *       and text, sorted by any column, paginated (10 / 25 / 50), plus the
 *       stat tiles: live listings, total views, saves, offers waiting, earned this month.
 */
import "server-only";
import { db } from "@/lib/supabase/server";
import { CARD_SELECT, mapCard } from "./queries";
import type { ListingCard } from "./types";

export const TABS = { active: ["active"], paused: ["paused"], sold: ["sold", "claimed"], ended: ["closed", "expired"], deleted: ["deleted"] } as const;
export type Tab = keyof typeof TABS;
export const SORT_COLS = { title: "title", price: "price", mrp: "mrp", age: "purchased_on", views: "views", saves: "saves", updated: "updated_at" } as const;
export type SortCol = keyof typeof SORT_COLS;

export type MyParams = { tab: Tab; mode: string; cat: string; q: string; sort: SortCol; dir: "asc" | "desc"; page: number; size: 10 | 25 | 50 };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads the table state from the URL. */
export function parseMy(sp: SP): MyParams {
  const tab = one(sp.tab) as Tab;
  const sort = one(sp.sort) as SortCol;
  const size = Number(one(sp.size));
  return {
    tab: tab in TABS ? tab : "active",
    mode: ["sell", "rent", "auction", "drop"].includes(one(sp.mode)) ? one(sp.mode) : "",
    cat: one(sp.cat).slice(0, 30),
    q: one(sp.q).slice(0, 80),
    sort: sort in SORT_COLS ? sort : "updated",
    dir: one(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(one(sp.page)) || 1),
    size: size === 25 || size === 50 ? size : 10,
  };
}

/** One page of the owner's listings plus counts per tab. */
export async function myListings(sellerId: string, p: MyParams): Promise<{ rows: ListingCard[]; total: number; counts: Record<Tab, number> }> {
  let q = db().from("listings").select(CARD_SELECT, { count: "exact" }).eq("seller_id", sellerId).in("status", [...TABS[p.tab]]);
  if (p.mode) q = q.eq("mode", p.mode);
  if (p.cat) q = q.eq("category_id", p.cat);
  if (p.q) q = q.ilike("title", `%${p.q.replace(/[%_]/g, "")}%`);
  if (p.tab === "deleted") q = q.gt("deleted_at", new Date(Date.now() - 30 * 864e5).toISOString());
  q = q.order(SORT_COLS[p.sort], { ascending: p.dir === "asc", nullsFirst: false }).range((p.page - 1) * p.size, p.page * p.size - 1);
  const [{ data, count }, { data: all }] = await Promise.all([q, db().from("listings").select("status,deleted_at").eq("seller_id", sellerId)]);
  const counts = { active: 0, paused: 0, sold: 0, ended: 0, deleted: 0 } as Record<Tab, number>;
  for (const r of all ?? []) {
    const tab = (Object.keys(TABS) as Tab[]).find((t) => (TABS[t] as readonly string[]).includes(r.status));
    if (tab && !(tab === "deleted" && new Date(r.deleted_at).getTime() < Date.now() - 30 * 864e5)) counts[tab]++;
  }
  return { rows: (data ?? []).map((r) => mapCard(r)), total: count ?? 0, counts };
}

/** Stat tiles for the dashboard. */
export async function myStats(sellerId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ data: ls }, { data: convs }, { data: tx }] = await Promise.all([
    db().from("listings").select("id,status,views,saves").eq("seller_id", sellerId).neq("status", "deleted"),
    db().from("conversations").select("id").or(`user_a.eq.${sellerId},user_b.eq.${sellerId}`),
    db().from("transactions").select("amount,kind,stage").eq("seller_id", sellerId).gte("created_at", monthStart.toISOString()),
  ]);
  const convIds = (convs ?? []).map((c) => c.id);
  const { count: offers } = convIds.length
    ? await db().from("messages").select("id", { count: "exact", head: true }).in("conversation_id", convIds).eq("kind", "offer").eq("offer_status", "pending").neq("sender_id", sellerId)
    : { count: 0 };
  return {
    live: (ls ?? []).filter((l) => l.status === "active").length,
    views: (ls ?? []).reduce((a, l) => a + l.views, 0),
    saves: (ls ?? []).reduce((a, l) => a + l.saves, 0),
    offers: offers ?? 0,
    // Earned = deals this month that have been handed over (stage 1 or later).
    earned: (tx ?? []).filter((t) => t.stage >= 1).reduce((a, t) => a + t.amount, 0),
  };
}

/** Which of these listings have bids or upcoming bookings (for the delete guard rails). */
export async function guardInfo(ids: string[]): Promise<Record<string, { bids: number; booked: boolean }>> {
  if (!ids.length) return {};
  const [{ data: bids }, { data: books }] = await Promise.all([
    db().from("bids").select("listing_id").in("listing_id", ids),
    db().from("rental_bookings").select("listing_id").in("listing_id", ids).eq("status", "confirmed").filter("period", "ov", `[${new Date().toISOString()},)`),
  ]);
  const out: Record<string, { bids: number; booked: boolean }> = Object.fromEntries(ids.map((i) => [i, { bids: 0, booked: false }]));
  for (const b of bids ?? []) out[b.listing_id].bids++;
  for (const b of books ?? []) out[b.listing_id].booked = true;
  return out;
}
