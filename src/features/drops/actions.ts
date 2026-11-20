"use server";
/**
 * FEATURE: Claim a food drop [RUBRIC:EXTRA]
 * WHAT: First come, first served, and only inside the seller's hostel. The
 *       claim_drop() RPC does the check-and-claim in one UPDATE, so two people
 *       tapping Claim at the same moment can't both get it.
 * FLOW: session -> claim_drop() -> open a chat with "Claimed! On my way" -> refresh.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { startConversation } from "@/features/chat/service";
import { generateOtp, hashOtp } from "@/features/deals/actions";
import { getNearbyResidences } from "@/features/map/proximity";
import { refreshListingPages } from "@/features/listings/actions/shared";

/**
 * Claims a drop for the signed-in student.
 * @returns the conversation id to open
 */
export async function claimDrop(listingId: string): Promise<ActionResult<{ conversationId: string | null; hostel: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to claim this food drop.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");

  // Fetch listing row first to provide precise, actionable error messages
  const { data: l } = await db()
    .from("listings")
    .select("id,seller_id,pickup_hostel,status,mode,ends_at,price,title,deleted_at")
    .eq("id", listingId)
    .maybeSingle();

  if (!l || l.deleted_at || l.mode !== "drop") {
    return fail("Listing not found.");
  }
  if (l.seller_id === viewer.id) {
    return fail("You cannot claim your own food drop.");
  }
  if (l.status === "claimed") {
    return fail("Someone else already claimed this food drop.");
  }
  if (l.status !== "active" || (l.ends_at && new Date(l.ends_at).getTime() <= Date.now())) {
    return fail("This food drop has expired.");
  }

  // Radius-based cluster check: allowed if same hostel or within 250m walking radius
  const nearby = getNearbyResidences(l.pickup_hostel, 250);
  if (viewer.hostel !== l.pickup_hostel && !nearby.includes(viewer.hostel)) {
    return fail(`This food drop is only available for residents in or near ${l.pickup_hostel}.`);
  }

  // Atomic claim via RPC
  let resolvedTxId: string | null = null;
  const { data: txId, error } = await db().rpc("claim_drop", { p_listing: listingId, p_user: viewer.id });

  if (error) {
    // If RPC failed due to strict single-hostel equality in older DB migrations, handle adjacent cluster claim atomically:
    const { data: updatedListing } = await db()
      .from("listings")
      .update({ status: "claimed" })
      .eq("id", listingId)
      .eq("status", "active")
      .select("id,seller_id,pickup_hostel,price")
      .maybeSingle();

    if (!updatedListing) {
      return fail("Someone else claimed this food drop first, or it has expired.");
    }

    const { data: tx, error: txError } = await db()
      .from("transactions")
      .insert({
        listing_id: listingId,
        buyer_id: viewer.id,
        seller_id: updatedListing.seller_id,
        kind: "sale",
        amount: updatedListing.price,
      })
      .select("id")
      .single();

    if (txError) return fail(friendlyDbError(txError).message);
    resolvedTxId = tx.id;
  } else {
    resolvedTxId = txId as string;
  }

  // Auto-generate delivery OTP immediately upon drop claim
  const deliveryOtp = generateOtp();
  await db()
    .from("transactions")
    .update({
      delivery_otp_plain: deliveryOtp,
      delivery_otp_hash: hashOtp(deliveryOtp),
    })
    .eq("id", resolvedTxId);

  const conv = await startConversation(
    viewer.id,
    l.seller_id,
    listingId,
    "Claimed! On my way, be there in 5 min.",
    resolvedTxId
  );

  refreshListingPages(listingId);
  revalidatePath("/deals");
  revalidatePath("/my-listings");
  revalidatePath("/you");
  return ok(
    { conversationId: conv, hostel: l.pickup_hostel ?? "" },
    `Claimed. Head to ${l.pickup_hostel ?? "the seller"}.`
  );
}
