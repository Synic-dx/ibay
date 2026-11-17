"use server";
/**
 * FEATURE: Live auctions [RUBRIC:EXTRA]
 * WHAT: placeBid() and buyNow(). place_bid() in Postgres locks the listing
 *       row, checks the minimum next bid (₹20 / ₹50 / ₹100 steps) and extends
 *       the end by 2 minutes for late bids (anti-sniping). Everyone watching
 *       the item sees the new bid instantly through Supabase Realtime.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { fmt, nextBid } from "@/lib/format";
import { bidSchema } from "@/lib/validation/market";
import { rateLimit } from "@/lib/security/guard";
import { sendNoticeEmail } from "@/lib/email";
import { ping, startConversation } from "@/features/chat/service";

/**
 * Places a bid.
 * @returns the new amount and whether the timer was extended
 */
export async function placeBid(listingId: string, amount: number | string): Promise<ActionResult<{ amount: number; extended: boolean }>> {
  // 1. Signed in?
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to bid.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success) return fail("Auction not found.");
  // 2. Work out the current minimum for a friendly message (the RPC checks again under a lock).
  const { data: l } = await db().from("listings").select("title,price,reserve_price,seller_id,bids(count)").eq("id", listingId).maybeSingle();
  if (!l) return fail("Auction not found.");
  const hasBids = (l.bids?.[0]?.count ?? 0) > 0;
  const parsed = bidSchema(nextBid(hasBids ? l.price : 0, l.reserve_price ?? l.price)).safeParse({ listingId, amount });
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`bid:${viewer.id}`, 60, 20))) return fail("Too many bids in a minute. Wait a moment.");
  // 3. Atomic bid in the database.
  const { data, error } = await db().rpc("place_bid", { p_listing: listingId, p_bidder: viewer.id, p_amount: parsed.data.amount });
  if (error) return fail(friendlyDbError(error).message, { amount: friendlyDbError(error).message });
  const res = data as { amount: number; extended: boolean; outbid_user: string | null };
  // 4. Tell the person who was outbid (bell + email if they allow it) and the seller.
  if (res.outbid_user) {
    await ping([res.outbid_user], "bid");
    const { data: o } = await db().from("profiles").select("email,notify_prefs").eq("id", res.outbid_user).single();
    if (o && o.notify_prefs?.email !== false && o.notify_prefs?.outbid !== false) {
      await sendNoticeEmail(o.email, `You were outbid on ${l.title}`, `Someone bid ${fmt(res.amount)} on ${l.title}. Bid again before the timer runs out.`, `/item/${listingId}`);
    }
  }
  await ping([l.seller_id], "bid");
  revalidatePath(`/item/${listingId}`);
  revalidatePath("/");
  return ok({ amount: res.amount, extended: res.extended }, res.extended ? "Bid placed. Timer extended by 2 minutes." : "Bid placed. You are the highest bidder.");
}

/** Buy it now: ends the auction at the buy-now price for you. */
export async function buyNow(listingId: string): Promise<ActionResult<{ conversationId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to buy.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success) return fail("Auction not found.");
  const { data: tx, error } = await db().rpc("auction_buy_now", { p_listing: listingId, p_buyer: viewer.id });
  if (error) return fail(friendlyDbError(error).message);
  const { data: l } = await db().from("listings").select("seller_id,price").eq("id", listingId).single();
  const conv = l ? await startConversation(viewer.id, l.seller_id, listingId, `Hi! I used Buy it now at ${fmt(l.price)}. When can I pick it up?`, tx as string) : null;
  revalidatePath(`/item/${listingId}`);
  revalidatePath("/");
  return ok({ conversationId: conv }, "It is yours. Arrange pickup in chat.");
}
