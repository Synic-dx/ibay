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
import { formatHandoverSchedule } from "./scheduling";

const WHEN = ["Today, evening", "Tomorrow, morning", "Tomorrow, evening", "Ask in chat"];

/**
 * "Buy now" / "I want this": creates the deal and messages the seller.
 * Nothing is charged; payment is UPI or cash at handover.
 */
export async function requestBuy(
  listingId: string,
  scheduledTime?: string | number | null,
  note?: string
): Promise<ActionResult<{ conversationId: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to buy.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success) return fail("Invalid listing ID.");

  const { data: l } = await db()
    .from("listings")
    .select("id,seller_id,price,mode,status,deleted_at,pickup_hostel")
    .eq("id", listingId)
    .maybeSingle();

  if (!l || l.status !== "active" || l.deleted_at || (l.mode !== "sell" && l.mode !== "drop")) {
    return fail("This item is no longer available.");
  }
  if (l.seller_id === viewer.id) return fail("You can't buy your own listing.");

  let scheduledAtIso: string | null = null;
  let pickupNote = note || "Pickup to be coordinated";

  if (l.mode === "drop") {
    pickupNote = "Immediate pickup · Ready now";
  } else if (typeof scheduledTime === "string" && scheduledTime.trim()) {
    scheduledAtIso = scheduledTime;
    pickupNote = formatHandoverSchedule(scheduledTime);
  } else if (typeof scheduledTime === "number" && WHEN[scheduledTime]) {
    pickupNote = WHEN[scheduledTime];
  }

  const { data: tx, error } = await db()
    .from("transactions")
    .insert({
      listing_id: l.id,
      buyer_id: viewer.id,
      seller_id: l.seller_id,
      kind: "sale",
      amount: l.price,
      pickup_note: pickupNote,
      handover_scheduled_at: scheduledAtIso,
      handover_status: l.mode === "drop" ? "confirmed" : "proposed",
      handover_proposed_by: viewer.id,
    })
    .select("id")
    .single();

  if (error) return fail(friendlyDbError(error).message);

  const msg =
    l.mode === "drop"
      ? `Hi! I'm coming to pick up the food drop at ${l.pickup_hostel} right now.`
      : scheduledAtIso
      ? l.price
        ? `Hi! I'll take it at ${fmt(l.price)}. Can we meet for handover on ${pickupNote}?`
        : `Hi! I'd love to take this. Can we meet for handover on ${pickupNote}?`
      : l.price
      ? `Hi! I'll take it at ${fmt(l.price)}. Pickup ${pickupNote.toLowerCase()} works for me?`
      : `Hi! I'd love to take this. Pickup ${pickupNote.toLowerCase()}?`;

  const conv = await startConversation(viewer.id, l.seller_id, l.id, msg, tx.id);
  await notify(
    l.seller_id,
    "buy",
    "bag",
    `${viewer.name.split(" ")[0]} wants to buy your item. Reply in chat.`,
    conv ? `/messages/${conv}` : "/deals"
  );
  revalidatePath("/deals");
  return ok({ conversationId: conv }, "Request sent");
}

/** Confirms the proposed handover time for a deal. */
export async function confirmHandoverTime(txId: string): Promise<ActionResult<{ txId: string; status: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(txId).success) return fail("Deal not found.");

  const { data: tx, error: fetchErr } = await db()
    .from("transactions")
    .select("id, buyer_id, seller_id, handover_scheduled_at, handover_status")
    .eq("id", txId)
    .single();

  if (fetchErr || !tx) return fail("Deal not found.");
  if (tx.buyer_id !== viewer.id && tx.seller_id !== viewer.id) {
    return fail("Unauthorized to update this deal.", undefined, "AUTH");
  }

  const { error } = await db()
    .from("transactions")
    .update({ handover_status: "confirmed" })
    .eq("id", txId);

  if (error) return fail(friendlyDbError(error).message);

  const otherId = tx.buyer_id === viewer.id ? tx.seller_id : tx.buyer_id;
  await notify(
    otherId,
    "deal",
    "check",
    `${viewer.name.split(" ")[0]} confirmed the handover meeting time.`,
    "/deals"
  );

  revalidatePath("/deals");
  revalidatePath("/messages");
  return ok({ txId, status: "confirmed" }, "Handover time confirmed");
}

/** Reschedules the handover time for a deal. */
export async function rescheduleHandoverTime(
  txId: string,
  newScheduledAt: string
): Promise<ActionResult<{ txId: string; scheduledAt: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(txId).success) return fail("Deal not found.");
  if (!newScheduledAt || Number.isNaN(new Date(newScheduledAt).getTime())) {
    return fail("Please pick a valid date and time.");
  }

  const { data: tx, error: fetchErr } = await db()
    .from("transactions")
    .select("id, buyer_id, seller_id")
    .eq("id", txId)
    .single();

  if (fetchErr || !tx) return fail("Deal not found.");
  if (tx.buyer_id !== viewer.id && tx.seller_id !== viewer.id) {
    return fail("Unauthorized to update this deal.", undefined, "AUTH");
  }

  const formatted = formatHandoverSchedule(newScheduledAt);
  const { error } = await db()
    .from("transactions")
    .update({
      handover_scheduled_at: newScheduledAt,
      handover_status: "rescheduled",
      handover_proposed_by: viewer.id,
      pickup_note: formatted,
    })
    .eq("id", txId);

  if (error) return fail(friendlyDbError(error).message);

  const otherId = tx.buyer_id === viewer.id ? tx.seller_id : tx.buyer_id;
  await notify(
    otherId,
    "deal",
    "clock",
    `${viewer.name.split(" ")[0]} proposed a new handover time: ${formatted}.`,
    "/deals"
  );

  revalidatePath("/deals");
  revalidatePath("/messages");
  return ok({ txId, scheduledAt: newScheduledAt }, `Proposed new time: ${formatted}`);
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

/** Updates the agreed meeting spot on a deal. */
export async function updateHandoverSpot(
  txId: string,
  spot: { name: string; lat: number; lng: number }
): Promise<ActionResult<{ txId: string; spot: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(txId).success) return fail("Deal not found.");

  const { data: tx, error: fetchErr } = await db()
    .from("transactions")
    .select("id, buyer_id, seller_id")
    .eq("id", txId)
    .single();

  if (fetchErr || !tx) return fail("Transaction not found.");
  if (tx.buyer_id !== viewer.id && tx.seller_id !== viewer.id) {
    return fail("Unauthorized to update this deal.", undefined, "AUTH");
  }

  const label = `Spot: ${spot.name} (${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)})`;
  const { error } = await db().from("transactions").update({ pickup_note: label }).eq("id", txId);
  if (error) return fail(friendlyDbError(error).message);

  revalidatePath("/deals");
  return ok({ txId, spot: spot.name }, `Meeting spot updated to ${spot.name}`);
}

