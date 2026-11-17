"use server";
/**
 * FEATURE: Deals, handovers and ratings [RUBRIC:EXTRA]
 * WHAT: requestBuy() (Buy now: pick a pickup time, nothing is charged),
 *       advanceDeal() (handover check: photos taken, payment / deposit done),
 *       rateDeal() (score -10 to +10 with a required reason; Plume updates in
 *       a database trigger; editable for 24 hours).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { fmt } from "@/lib/format";
import { ratingSchema, type RatingInput } from "@/lib/validation/market";
import { notify, startConversation } from "@/features/chat/service";

const WHEN = ["Today, evening", "Tomorrow, morning", "Tomorrow, evening", "Ask in chat"];

/**
 * "Buy now" / "I want this": creates the deal and messages the seller.
 * Nothing is charged; payment is UPI or cash at handover.
 */
export async function requestBuy(listingId: string, when: number): Promise<ActionResult<{ conversationId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to buy.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success || !WHEN[when]) return fail("Pick a pickup time.");
  const { data: l } = await db().from("listings").select("id,seller_id,price,mode,status,deleted_at").eq("id", listingId).maybeSingle();
  if (!l || l.status !== "active" || l.deleted_at || l.mode !== "sell") return fail("This item is no longer available.");
  if (l.seller_id === viewer.id) return fail("You can't buy your own listing.");
  const { data: tx, error } = await db().from("transactions").insert({ listing_id: l.id, buyer_id: viewer.id, seller_id: l.seller_id, kind: "sale", amount: l.price, pickup_note: WHEN[when] }).select("id").single();
  if (error) return fail(friendlyDbError(error).message);
  const msg = l.price ? `Hi! I'll take it at ${fmt(l.price)}. Pickup ${WHEN[when].toLowerCase()} works for me?` : `Hi! I'd love to take this. Pickup ${WHEN[when].toLowerCase()}?`;
  const conv = await startConversation(viewer.id, l.seller_id, l.id, msg, tx.id);
  await notify(l.seller_id, "buy", "bag", `${viewer.name.split(" ")[0]} wants to buy your item. Reply in chat.`, conv ? `/messages/${conv}` : "/deals");
  revalidatePath("/deals");
  return ok({ conversationId: conv }, "Request sent");
}

/** Handover check: moves the deal to the next step. */
export async function advanceDeal(txId: string, photos: boolean, money: boolean): Promise<ActionResult<{ stage: number }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(txId).success) return fail("Deal not found.");
  const { data, error } = await db().rpc("advance_deal", { p_tx: txId, p_actor: viewer.id, p_photos: photos, p_money: money });
  if (error) return fail(friendlyDbError(error).message);
  const { data: t } = await db().from("transactions").select("buyer_id,seller_id").eq("id", txId).single();
  if (t) await notify(t.buyer_id === viewer.id ? t.seller_id : t.buyer_id, "deal", "check", `${viewer.name.split(" ")[0]} confirmed the handover. You can rate the deal now.`, "/deals");
  revalidatePath("/deals");
  return ok({ stage: data as number }, "Confirmed");
}

/** Rate the other person after the handover (or edit your rating within 24 hours). */
export async function rateDeal(input: RatingInput): Promise<ActionResult<{ delta: number; plumeAfter: number }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  // Same schema as the rating sheet: score -10..10, reason 10..500 characters.
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { data, error } = await db().rpc("submit_rating", { p_tx: v.transactionId, p_rater: viewer.id, p_score: v.score, p_reason: v.reason, p_tags: v.tags });
  if (error) {
    const f = friendlyDbError(error);
    return fail(f.message, f.field ? { [f.field]: f.message } : undefined);
  }
  const r = data as { delta: number; plume_after: number };
  revalidatePath("/deals");
  revalidatePath("/you");
  return ok({ delta: Number(r.delta), plumeAfter: Number(r.plume_after) }, "Thanks. Your rating is on their profile.");
}
