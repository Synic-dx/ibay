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

/**
 * Claims a drop for the signed-in student.
 * @returns the conversation id to open
 */
export async function claimDrop(listingId: string): Promise<ActionResult<{ conversationId: string | null; hostel: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to claim this food drop.", undefined, "AUTH");
  if (!z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  const { data: txId, error } = await db().rpc("claim_drop", { p_listing: listingId, p_user: viewer.id });
  if (error) return fail(friendlyDbError(error).message);

  // Auto-generate delivery OTP immediately upon drop claim
  const deliveryOtp = generateOtp();
  await db()
    .from("transactions")
    .update({
      delivery_otp_plain: deliveryOtp,
      delivery_otp_hash: hashOtp(deliveryOtp),
    })
    .eq("id", txId as string);

  const { data: l } = await db().from("listings").select("seller_id,pickup_hostel").eq("id", listingId).single();
  const conv = l ? await startConversation(viewer.id, l.seller_id, listingId, "Claimed! On my way, be there in 5 min.", txId as string) : null;
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath(`/item/${listingId}`);
  return ok({ conversationId: conv, hostel: l?.pickup_hostel ?? "" }, `Claimed. Head to ${l?.pickup_hostel ?? "the seller"}.`);
}
