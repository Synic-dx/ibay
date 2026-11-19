/**
 * FEATURE: Reading listings (the "R" in CRUD) [RUBRIC:CRUD-READ] [RUBRIC:DATA-DISPLAY]
 * WHAT: Server-only queries for cards, browse/search, the item page and the
 *       owner's dashboard. Visibility rules (active, not deleted, hostel-only
 *       food drops, banned sellers hidden) match the RLS policy in the database.
 */
import "server-only";
import { db } from "@/lib/supabase/server";
import { istDay } from "@/lib/format";
import { nextFreeLabel } from "@/features/rentals/slots";
import { getNearbyResidences, getEffectiveListingHostel } from "@/features/map/proximity";
import type { Viewer } from "@/lib/auth/session";
import type { ListingCard, ListingDetail, ListingPhoto, ListingStatus } from "./types";

// WHY "as "*"": the column list is built from pieces, so we tell the query builder to treat rows
// as plain objects; mapCard() below turns them into the typed ListingCard.
export const CARD_SELECT = (
  "id,title,mode,category_id,price,mrp,rent_unit,deposit,reserve_price,buy_now_price,ends_at,status,purchased_on,condition," +
  "ticket_info,is_bundle,bundle_contents,bundle_items,price_drop_amount,price_dropped_at,pickup_hostel,pickup_lat,pickup_lng,pickup_slots,views,saves,brand,model,size,tags," +
  "created_at,updated_at,deleted_at," +
  "seller:profiles!listings_seller_id_fkey(id,name,hostel,plume,rated_deals,avatar_url,avatar_color,response_note,banned)," +
  "images:listing_images(url,fit,position,public_id),bids(count)") as "*";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from PostgREST joins and are mapped right here */
type Row = Record<string, any>;

/** Maps a database row (with seller, images and bid count) to a card. */
export function mapCard(r: Row, saved: Set<string> = new Set()): ListingCard {
  const imgs: Row[] = [...(r.images ?? [])].sort((a, b) => a.position - b.position);
  const s = r.seller ?? {};
  const lat = r.pickup_lat != null ? Number(r.pickup_lat) : null;
  const lng = r.pickup_lng != null ? Number(r.pickup_lng) : null;
  const effectiveHostel = getEffectiveListingHostel({
    pickupHostel: r.pickup_hostel,
    pickupLat: lat,
    pickupLng: lng,
    seller: s,
  });

  return {
    id: r.id,
    title: r.title,
    mode: r.mode,
    categoryId: r.category_id,
    price: r.price,
    mrp: r.mrp,
    rentUnit: r.rent_unit,
    deposit: r.deposit,
    reservePrice: r.reserve_price,
    buyNowPrice: r.buy_now_price,
    endsAt: r.ends_at,
    status: r.status,
    purchasedOn: r.purchased_on,
    condition: r.condition,
    photo: imgs[0] ? { url: imgs[0].url, fit: imgs[0].fit, publicId: imgs[0].public_id } : null,
    ticketInfo: r.ticket_info ?? [],
    isBundle: r.is_bundle,
    bundleCount: (r.bundle_items?.length || r.bundle_contents?.length || 0) as number,
    bidCount: r.bids?.[0]?.count ?? 0,
    priceDropAmount: r.price_drop_amount,
    priceDroppedAt: r.price_dropped_at,
    pickupHostel: effectiveHostel,
    pickupLat: lat,
    pickupLng: lng,
    pickupSlots: r.pickup_slots ?? [],
    seller: {
      id: s.id,
      name: s.name ?? "Student",
      hostel: s.hostel ?? r.pickup_hostel,
      plume: Number(s.plume ?? 0),
      ratedDeals: s.rated_deals ?? 0,
      avatarUrl: s.avatar_url ?? null,
      avatarColor: s.avatar_color ?? "#02505F",
      responseNote: s.response_note ?? null,
    },
    views: r.views,
    saves: r.saves,
    saved: saved.has(r.id),
    brand: r.brand,
    model: r.model,
    size: r.size,
    tags: r.tags ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ids the viewer has hearted. */
export async function savedIds(viewerId: string | undefined): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const { data } = await db().from("saved_items").select("listing_id").eq("user_id", viewerId);
  return new Set((data ?? []).map((r) => r.listing_id as string));
}

/** "2026-11-18 13:00:00+00" (Postgres range bound) -> ISO string. */
export function parsePgTime(s: string): string {
  const t = s.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  return new Date(t).toISOString();
}

/** Booked [start, end) periods for rentals over the next 15 days, keyed by listing id. */
export async function upcomingBookings(listingIds: string[]): Promise<Map<string, { start: string; end: string }[]>> {
  const out = new Map<string, { start: string; end: string }[]>();
  if (!listingIds.length) return out;
  const from = istDay(0).toISOString();
  const to = istDay(15).toISOString();
  const { data } = await db()
    .from("rental_bookings")
    .select("listing_id,period")
    .in("listing_id", listingIds)
    .eq("status", "confirmed")
    .filter("period", "ov", `[${from},${to})`);
  for (const b of data ?? []) {
    const m = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(b.period as string);
    if (!m) continue;
    const list = out.get(b.listing_id) ?? [];
    list.push({ start: parsePgTime(m[1]), end: parsePgTime(m[2]) });
    out.set(b.listing_id, list);
  }
  return out;
}

/** Adds the next-free label to hourly rentals. */
async function withNextFree(cards: ListingCard[]): Promise<ListingCard[]> {
  const hourly = cards.filter((c) => c.mode === "rent" && c.rentUnit === "hour").map((c) => c.id);
  if (!hourly.length) return cards;
  const bk = await upcomingBookings(hourly);
  return cards.map((c) => (hourly.includes(c.id) ? { ...c, nextFree: nextFreeLabel(bk.get(c.id) ?? []) } : c));
}

/**
 * Cards for a list of ids, in the same order.
 * @param ids listing ids (e.g. from browse_listing_ids)
 * @param viewerId for saved hearts
 */
export async function cardsByIds(ids: string[], viewerId?: string): Promise<ListingCard[]> {
  if (!ids.length) return [];
  const [{ data }, saved] = await Promise.all([db().from("listings").select(CARD_SELECT).in("id", ids), savedIds(viewerId)]);
  const byId = new Map((data ?? []).map((r) => [r.id as string, mapCard(r, saved)]));
  return withNextFree(ids.map((id) => byId.get(id)).filter((c): c is ListingCard => Boolean(c)));
}

export type BrowseParams = {
  q?: string;
  category?: string;
  modes?: string[];
  near?: boolean;
  trusted?: boolean;
  ageMonths?: number;
  min?: number;
  max?: number;
  size?: string;
  available?: string;
  collection?: string;
  sort?: string;
  limit?: number;
  offset?: number;
};

/**
 * Search + filters + sort + pagination (runs the browse_listing_ids RPC).
 * @returns the page of cards and the total number of matches
 */
export async function browseListings(p: BrowseParams, viewer: Viewer | null): Promise<{ items: ListingCard[]; total: number }> {
  const { data, error } = await db().rpc("browse_listing_ids", {
    p_q: p.q || null,
    p_category: p.category && p.category !== "all" ? p.category : null,
    p_modes: p.modes?.length ? p.modes : null,
    p_viewer: viewer?.id ?? null,
    p_near: Boolean(p.near),
    p_trusted: Boolean(p.trusted),
    p_age_months: p.ageMonths ?? null,
    p_min: p.min ?? null,
    p_max: p.max ?? null,
    p_size: p.size || null,
    p_available: p.available || null,
    p_collection: p.collection || null,
    p_sort: p.sort || "best",
    p_limit: p.limit ?? 24,
    p_offset: p.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; total: number }[];
  return { items: await cardsByIds(rows.map((r) => r.id), viewer?.id), total: rows[0]?.total ?? 0 };
}

/**
 * Every listing a visitor can currently see (used for the home page rails,
 * which need many small slices of the same catalogue).
 */
export async function visibleCatalogue(viewer: Viewer | null): Promise<ListingCard[]> {
  const nowIso = new Date().toISOString();
  const [{ data }, saved] = await Promise.all([
    db().from("listings").select(CARD_SELECT).eq("status", "active").is("deleted_at", null).order("created_at", { ascending: false }).limit(150),
    savedIds(viewer?.id),
  ]);
  const cards = (data ?? [])
    .filter((r) => !r.seller?.banned)
    .map((r) => mapCard(r, saved))
    .filter((c) => !(c.mode === "auction" || c.mode === "drop") || (c.endsAt && c.endsAt > nowIso));
  return withNextFree(cards);
}

/** Whether a viewer may see a food drop (same hostel or within 250m walking radius). */
export const canSeeDrop = (c: ListingCard, viewer: Viewer | null) => {
  if (c.mode !== "drop") return true;
  if (!viewer?.hostel) return false;
  if (viewer.hostel === c.pickupHostel) return true;
  const nearby = getNearbyResidences(c.pickupHostel, 250);
  return nearby.includes(viewer.hostel);
};

/**
 * The item page. Owners see their listing in any state; everyone else only
 * sees active listings (and food drops only inside their hostel).
 * @returns null when the listing doesn't exist or isn't visible (the page shows a 404)
 */
export async function getListingDetail(id: string, viewer: Viewer | null): Promise<ListingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: r } = await db()
    .from("listings")
    .select(CARD_SELECT + ",description,specs,seal_status,expires_on,status_before_delete,pickup_note")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const row = r as unknown as Record<string, unknown> & { seller?: { banned?: boolean } };
  const saved = await savedIds(viewer?.id);
  const card = mapCard(row, saved);
  const mine = viewer?.id === card.seller.id;
  const admin = viewer?.role === "admin";
  // WHY: anything not visible returns null -> 404, so ids can't be probed.
  if (!mine && !admin) {
    if (card.status === "deleted" || card.status === "hidden" || row.seller?.banned) return null;
    if (card.mode === "drop" && !canSeeDrop(card, viewer)) return null;
  }

  const [{ data: bids }, bookings, bundleItems, partOf] = await Promise.all([
    db().from("bids").select("id,amount,created_at,bidder:profiles(id,name)").eq("listing_id", id).order("amount", { ascending: false }).limit(20),
    card.mode === "rent" ? upcomingBookings([id]) : Promise.resolve(new Map()),
    (row.bundle_items as string[] | null)?.length ? cardsByIds(row.bundle_items as string[], viewer?.id) : Promise.resolve([]),
    db().from("listings").select(CARD_SELECT).contains("bundle_items", [id]).eq("status", "active").is("deleted_at", null).limit(1),
  ]);
  const photos: ListingPhoto[] = ((row.images as { url: string; fit: "contain" | "cover"; position: number; public_id: string | null }[]) ?? [])
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ url: i.url, fit: i.fit, publicId: i.public_id }));
  const books = bookings.get(id) ?? [];

  return {
    ...card,
    nextFree: card.mode === "rent" && card.rentUnit === "hour" ? nextFreeLabel(books) : undefined,
    description: (row.description as string) ?? "",
    pickupNote: mine ? ((row.pickup_note as string | null) ?? null) : null,
    photos,
    specs: ((row.specs as unknown[]) ?? []).map((s) => (Array.isArray(s) ? { k: String(s[0]), v: String(s[1]) } : (s as { k: string; v: string }))),
    sealStatus: (row.seal_status as string) ?? null,
    expiresOn: (row.expires_on as string) ?? null,
    bundleContents: (row.bundle_contents as string[]) ?? [],
    bundleItems,
    partOfBundle: partOf.data?.[0] ? mapCard(partOf.data[0], saved) : null,
    bids: (bids ?? []).map((b) => {
      const bidder = b.bidder as unknown as { id: string; name: string } | null;
      return { id: b.id, amount: b.amount, createdAt: b.created_at, bidderId: bidder?.id ?? "", bidderName: bidder?.name ?? "Someone" };
    }),
    bookings: books,
    statusBeforeDelete: (row.status_before_delete as ListingStatus) ?? null,
  };
}

/** Similar items: same category, still active. */
export async function similarListings(l: ListingCard, viewer: Viewer | null): Promise<ListingCard[]> {
  const { items } = await browseListings({ category: l.categoryId, limit: 11, sort: "best" }, viewer);
  return items.filter((x) => x.id !== l.id).slice(0, 10);
}

/** "Similar on campus: ₹X to ₹Y" for fixed-price items with the same first tag. */
export async function typicalPrice(l: ListingCard): Promise<{ lo: number; hi: number } | null> {
  if (l.mode !== "sell" || !l.price || l.isBundle || !l.tags[0]) return null;
  const { data } = await db()
    .from("listings")
    .select("price")
    .eq("category_id", l.categoryId)
    .eq("mode", "sell")
    .eq("status", "active")
    .is("deleted_at", null)
    .contains("tags", [l.tags[0]])
    .neq("id", l.id)
    .gt("price", 0)
    .limit(30);
  const p = (data ?? []).map((r) => r.price as number);
  return p.length ? { lo: Math.min(...p), hi: Math.max(...p) } : null;
}
