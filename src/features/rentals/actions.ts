"use server";
/**
 * FEATURE: Rentals: book hours or days [RUBRIC:EXTRA]
 * WHAT: bookRental() saves a booking for a time range. Two people can never
 *       hold the same hour: the rental_bookings table has an exclusion
 *       constraint (listing = and period overlaps), so the second insert fails
 *       and we show "Some of that time was just booked".
 * FLOW: session -> range checks -> book_rental() (deal + booking) -> open chat -> refresh.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { friendlyDbError } from "@/lib/db-errors";
import { startConversation } from "@/features/chat/service";
import { generateOtp, hashOtp } from "@/features/deals/actions";
import { refreshListingPages } from "@/features/listings/actions/shared";

const schema = z
  .object({
    listingId: z.uuid(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    message: z.string().max(300),
  })
  .refine((v) => new Date(v.end) > new Date(v.start), { error: "Pick an end after the start." })
  .refine((v) => new Date(v.end).getTime() - new Date(v.start).getTime() <= 60 * 864e5, { error: "Bookings can be at most 60 days." })
  .refine((v) => new Date(v.start).getTime() < Date.now() + 15 * 864e5, { error: "You can book up to 14 days ahead." });

/**
 * Books a rental.
 * @param input listing, start and end (ISO), and the first chat message
 * @returns the conversation to open and the amount
 */
export async function bookRental(input: { listingId: string; start: string; end: string; message: string }): Promise<ActionResult<{ conversationId: string | null; amount: number }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to rent this.", undefined, "AUTH");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { listingId, start, end, message } = parsed.data;
  const { data, error } = await db().rpc("book_rental", { p_listing: listingId, p_renter: viewer.id, p_start: start, p_end: end });
  if (error) return fail(friendlyDbError(error).message);
  const res = data as { transaction_id: string; amount: number };

  // Auto-generate delivery and return OTPs immediately upon booking
  const deliveryOtp = generateOtp();
  const returnOtp = generateOtp();
  await db()
    .from("transactions")
    .update({
      delivery_otp_plain: deliveryOtp,
      delivery_otp_hash: hashOtp(deliveryOtp),
      return_otp_plain: returnOtp,
      return_otp_hash: hashOtp(returnOtp),
    })
    .eq("id", res.transaction_id);

  const { data: l } = await db().from("listings").select("seller_id").eq("id", listingId).single();
  const conv = l ? await startConversation(viewer.id, l.seller_id, listingId, message, res.transaction_id) : null;
  refreshListingPages(listingId);
  revalidatePath("/deals");
  revalidatePath("/my-listings");
  revalidatePath("/you");
  return ok({ conversationId: conv, amount: res.amount }, "Request sent");
}
