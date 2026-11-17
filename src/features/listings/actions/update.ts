"use server";
/**
 * FEATURE: Update a listing (the "U" in CRUD) [RUBRIC:CRUD-UPDATE] [RUBRIC:VALIDATION-SERVER]
 * WHAT: The full edit form plus quick updates from My listings:
 *       inline price, Pause/Resume, Extend auction, Mark sold, Relist.
 * WHO CAN USE IT: only the owner (checked here and again in update_listing()).
 * RULES (shown in the form as locked fields, enforced here and by a trigger):
 *   - auction with bids: starting bid, buy-now and end time are locked
 *   - rental with upcoming bookings: the unit is locked (rate changes apply to new bookings)
 *   - sold or ended: read-only, use Relist
 *   - food drop: only extend the time (3 h max in total) or edit the description
 * CONCURRENCY: the form sends the updated_at it loaded; if the row changed
 *   since (say you edited on your phone too) the save is refused.
 * FLOW: session -> Zod -> load + ownership -> mode locks -> photos -> update_listing() -> refresh.
 */
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { fmt } from "@/lib/format";
import { verifyPhotos } from "@/lib/uploads";
import { listingSchema, quickPriceSchema, type ListingInput } from "@/lib/validation/listing";
import { notify, startConversation } from "@/features/chat/service";
import { columnsFor, refreshListingPages } from "./shared";

/** Loads a listing for its owner, or null (so other people get "not found"). */
async function ownListing(id: string, viewerId: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await db().from("listings").select("*, images:listing_images(url), bids(count)").eq("id", id).maybeSingle();
  // WHY: someone else's id looks exactly like a missing one, so ids can't be probed.
  return data && data.seller_id === viewerId ? data : null;
}

/** True if someone holds a confirmed booking that has not ended yet. */
async function hasUpcomingBookings(id: string): Promise<boolean> {
  const { count } = await db()
    .from("rental_bookings")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", id)
    .eq("status", "confirmed")
    .filter("period", "ov", `[${new Date().toISOString()},)`);
  return (count ?? 0) > 0;
}

/** Turns a database error into an ActionResult (conflicts get a special code). */
function dbFail(error: { message?: string; code?: string }) {
  const f = friendlyDbError(error);
  return fail(f.message, f.field ? { [f.field]: f.message } : undefined, f.code ?? "DB");
}

/**
 * Saves the full edit form.
 * @param id the listing
 * @param input the same values as the sell form, plus updatedAt for the concurrency check
 */
export async function updateListing(id: string, input: ListingInput): Promise<ActionResult<{ id: string }>> {
  // 1. Signed in?
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  // 2. Same schema as the browser.
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  // 3. Owner only.
  const l = await ownListing(id, viewer.id);
  if (!l) return fail("Listing not found.", undefined, "NOT_FOUND");
  if (l.deleted_at) return fail("This listing was deleted. Restore it first.");
  if (d.mode !== l.mode) return fail("Deal type can't be changed after posting. Delete this and list it again.", { mode: "Locked after posting." });
  if (!["active", "paused"].includes(l.status)) return fail("Sold or ended listings are read-only. Use Relist to post a copy.", undefined, "READ_ONLY");

  // 4. Mode-aware locks.
  const cols = columnsFor(d);
  // WHY: keep existing tags (they put the item in collections such as Garba Night) and add new title words.
  const patch: Record<string, unknown> = { ...cols, tags: [...new Set([...((l.tags as string[]) ?? []), ...cols.tags])].slice(0, 30) };
  const bids = l.bids?.[0]?.count ?? 0;
  if (l.mode === "auction") {
    delete patch.price;
    if (bids > 0) {
      if (d.price !== l.reserve_price) return fail("People have already bid, so the starting bid is locked.", { price: "Locked: people have already bid." });
      delete patch.reserve_price;
      delete patch.buy_now_price;
    } else {
      patch.price = d.price;
    }
  }
  if (l.mode === "rent" && d.mode === "rent" && d.rentUnit !== l.rent_unit && (await hasUpcomingBookings(id))) {
    return fail("Someone has an upcoming booking, so the unit is locked.", { rentUnit: "Locked: there is an upcoming booking." });
  }
  if (l.mode === "drop") {
    // Only the description and a longer time are allowed.
    for (const k of Object.keys(patch)) if (k !== "description") delete patch[k];
    if (d.mode === "drop") {
      const newEnd = new Date(new Date(l.created_at).getTime() + d.availableMinutes * 60e3);
      if (newEnd.getTime() > new Date(l.ends_at).getTime()) patch.ends_at = newEnd.toISOString();
    }
  } else {
    // 5. Photos: unchanged ones are allowed, new ones must really be uploaded.
    const existing = ((l.images as { url: string }[]) ?? []).map((i) => i.url);
    const photoErr = await verifyPhotos(d.photos, existing);
    if (photoErr) return fail(photoErr, { photos: photoErr });
    patch.photos = d.photos.map((p) => ({ url: p.url, publicId: p.publicId ?? "", fit: p.fit }));
  }

  // 6. Save in one transaction (ownership, concurrency, audit, price history).
  const { error } = await db().rpc("update_listing", { p_listing: id, p_actor: viewer.id, p_expected: d.updatedAt ?? null, p_patch: patch });
  if (error) return dbFail(error);
  refreshListingPages(id);
  return ok({ id }, "Changes saved");
}

/**
 * Inline price edit from the My listings table (click, type, Enter).
 * Whole rupees, at least 1, not above the original price.
 */
export async function quickPrice(id: string, price: string | number): Promise<ActionResult<{ price: number; dropped: number | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const parsed = quickPriceSchema.safeParse({ id, price });
  if (!parsed.success) return invalid(parsed.error);
  const l = await ownListing(id, viewer.id);
  if (!l) return fail("Listing not found.");
  if (l.mode !== "sell" && l.mode !== "rent") return fail("Change auction and food drop prices from the edit form.");
  if (l.mrp && l.mode === "sell" && parsed.data.price > l.mrp) return fail(`Price can't be more than the original price (${fmt(l.mrp)}).`, { price: "Above the original price." });
  const { data, error } = await db().rpc("update_listing", { p_listing: id, p_actor: viewer.id, p_expected: null, p_patch: { price: parsed.data.price } });
  if (error) return dbFail(error);
  refreshListingPages(id);
  const drop = (data as { price_drop: number | null }).price_drop;
  return ok({ price: parsed.data.price, dropped: drop }, drop ? `Price dropped by ${fmt(drop)}. People who saved it get an alert.` : "Price updated");
}

/** Pause (hide from search without deleting) or resume. */
export async function setPaused(id: string, paused: boolean): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const l = await ownListing(id, viewer.id);
  if (!l) return fail("Listing not found.");
  const { error } = await db().rpc("update_listing", { p_listing: id, p_actor: viewer.id, p_expected: null, p_patch: { status: paused ? "paused" : "active" } });
  if (error) return dbFail(error);
  refreshListingPages(id);
  return ok(null, paused ? "Paused. It is hidden from search until you resume it." : "Live again");
}

/** Extend an auction (only while nobody has bid). */
export async function extendAuction(id: string, hours: number): Promise<ActionResult<null>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (![6, 24, 72].includes(hours)) return fail("Pick 6 hours, 1 day or 3 days.");
  const l = await ownListing(id, viewer.id);
  if (!l || l.mode !== "auction") return fail("Listing not found.");
  if ((l.bids?.[0]?.count ?? 0) > 0) return fail("People have already bid, so the end time is locked.");
  const base = Math.max(Date.now(), new Date(l.ends_at).getTime());
  const { error } = await db().rpc("update_listing", { p_listing: id, p_actor: viewer.id, p_expected: null, p_patch: { ends_at: new Date(base + hours * 3600e3).toISOString() } });
  if (error) return dbFail(error);
  refreshListingPages(id);
  return ok(null, "Auction extended");
}

/**
 * Mark as sold, optionally to someone you chatted with. Other chats about the
 * item get an automatic "sold" note.
 */
export async function markSold(id: string, buyerId: string | null): Promise<ActionResult<{ dealId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (buyerId && !z.uuid().safeParse(buyerId).success) return fail("Pick a buyer from the list.");
  const { data, error } = await db().rpc("mark_sold", { p_listing: id, p_actor: viewer.id, p_buyer: buyerId });
  if (error) return dbFail(error);
  if (buyerId) await notify(buyerId, "sold", "check", `${viewer.name.split(" ")[0]} marked the deal as handed over. Rate them when you can.`, "/deals");
  refreshListingPages(id);
  return ok({ dealId: (data as string) ?? null }, buyerId ? "Marked as sold. Rate them after the handover." : "Marked as sold");
}

/** End an auction: sell to any bidder (not only the highest) or end without selling. */
export async function closeAuction(id: string, bidId: string | null): Promise<ActionResult<{ conversationId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (bidId && !z.uuid().safeParse(bidId).success) return fail("Pick a bidder from the list.");
  const { data: tx, error } = await db().rpc("close_auction", { p_listing: id, p_actor: viewer.id, p_bid: bidId });
  if (error) return dbFail(error);
  let conv: string | null = null;
  if (bidId && tx) {
    const { data: b } = await db().from("bids").select("bidder_id,amount").eq("id", bidId).single();
    const { data: l } = await db().from("listings").select("title").eq("id", id).single();
    if (b) conv = await startConversation(viewer.id, b.bidder_id, id, `Hi! You won "${l?.title}" at ${fmt(b.amount)}. When can you pick it up?`, tx as string);
  }
  refreshListingPages(id);
  return ok({ conversationId: conv }, bidId ? "Sold. We opened a chat with the buyer." : "Auction ended without a sale");
}

/** Relist a sold or ended listing as a fresh copy. */
export async function relistListing(id: string): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  const { data, error } = await db().rpc("relist_listing", { p_listing: id, p_actor: viewer.id });
  if (error) return dbFail(error);
  refreshListingPages(data as string);
  return ok({ id: data as string }, "Relisted as a new listing");
}
