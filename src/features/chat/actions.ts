"use server";
/**
 * FEATURE: Chat actions [RUBRIC:EXTRA]
 * WHAT: open a chat about an item, send a message, send a structured offer,
 *       accept / decline an offer (counter = send another offer).
 * WHO CAN USE IT: only the two members of a thread.
 * FLOW: session -> membership check -> Zod -> insert -> realtime ping to the
 *       other person -> return the fresh thread.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { fmt } from "@/lib/format";
import { messageSchema, offerSchema } from "@/lib/validation/market";
import { rateLimit } from "@/lib/security/guard";
import { getThread, listThreads, type Thread, type ThreadSummary } from "./queries";
import { notify, ping, startConversation } from "./service";
import { generateOtp, hashOtp } from "@/features/deals/otp-crypto";

/** Loads a conversation and checks the viewer is in it. */
async function membership(convId: string) {
  const viewer = await getViewer();
  if (!viewer) return { error: fail("Please sign in again.", undefined, "AUTH") } as const;
  if (!z.uuid().safeParse(convId).success) return { error: fail("Chat not found.") } as const;
  const { data: c } = await db().from("conversations").select("id,user_a,user_b,listing_id").eq("id", convId).maybeSingle();
  if (!c || (c.user_a !== viewer.id && c.user_b !== viewer.id)) return { error: fail("Chat not found.") } as const;
  return { viewer, conv: c, other: (c.user_a === viewer.id ? c.user_b : c.user_a) as string } as const;
}

/** Thread list for the dock and the chats page. */
export async function fetchThreads(): Promise<ThreadSummary[]> {
  const viewer = await getViewer();
  return viewer ? listThreads(viewer.id) : [];
}

/** One thread (marks messages read). */
export async function fetchThread(convId: string): Promise<Thread | null> {
  const viewer = await getViewer();
  return viewer ? getThread(convId, viewer.id) : null;
}

/**
 * Opens (or reuses) the chat with a seller, optionally about an item and with a first message.
 * @returns the conversation id
 */
export async function openChat(otherId: string, listingId?: string | null, prefill?: string): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to chat with sellers.", undefined, "AUTH");
  if (!z.uuid().safeParse(otherId).success || otherId === viewer.id) return fail("You can't message yourself.");
  if (listingId && !z.uuid().safeParse(listingId).success) return fail("Listing not found.");
  if (prefill && prefill.length > 1000) return fail("Keep messages under 1,000 characters.");
  if (!(await rateLimit(`chat:${viewer.id}`, 60, 30))) return fail("Slow down a little. Try again in a minute.");
  const id = await startConversation(viewer.id, otherId, listingId, prefill?.trim() || undefined);
  if (!id) return fail("Couldn't open the chat.");
  revalidatePath("/messages");
  return ok({ id });
}

/** Sends a text message. */
export async function sendMessage(convId: string, body: string): Promise<ActionResult<Thread>> {
  const m = await membership(convId);
  if ("error" in m) return m.error!;
  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`chat:${m.viewer.id}`, 60, 30))) return fail("Slow down a little. Try again in a minute.");
  const { error } = await db().from("messages").insert({ conversation_id: convId, sender_id: m.viewer.id, body: parsed.data.body, listing_id: m.conv.listing_id });
  if (error) return fail("Message not sent. Try again.");
  await ping([m.other]);
  return ok((await getThread(convId, m.viewer.id))!);
}

/**
 * Sends a structured price offer. If the other person had a pending offer,
 * it becomes "Countered".
 */
export async function sendOffer(convId: string, amount: number | string): Promise<ActionResult<Thread>> {
  const m = await membership(convId);
  if ("error" in m) return m.error!;
  const parsed = offerSchema.safeParse({ amount });
  if (!parsed.success) return invalid(parsed.error);
  if (!m.conv.listing_id) return fail("Offers need an item. Open the chat from a listing.");
  await db().from("messages").update({ offer_status: "countered" }).eq("conversation_id", convId).eq("kind", "offer").eq("offer_status", "pending").neq("sender_id", m.viewer.id);
  const { error } = await db().from("messages").insert({
    conversation_id: convId, sender_id: m.viewer.id, kind: "offer", offer_amount: parsed.data.amount, offer_status: "pending", listing_id: m.conv.listing_id,
  });
  if (error) return fail("Offer not sent. Try again.");
  await notify(m.other, "offer", "tag", `${m.viewer.name.split(" ")[0]} offered ${fmt(parsed.data.amount)}.`, `/messages/${convId}`);
  return ok((await getThread(convId, m.viewer.id))!);
}

/**
 * Accepts or declines the other person's offer. Accepting creates the deal
 * (shown as "Deal agreed" in the chat and in Deals).
 */
export async function respondOffer(messageId: string, accept: boolean): Promise<ActionResult<Thread>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", undefined, "AUTH");
  if (!z.uuid().safeParse(messageId).success) return fail("Offer not found.");
  const { data: msg } = await db().from("messages").select("id,conversation_id,sender_id,offer_amount,offer_status,kind").eq("id", messageId).maybeSingle();
  if (!msg || msg.kind !== "offer") return fail("Offer not found.");
  const m = await membership(msg.conversation_id);
  if ("error" in m) return m.error!;
  // You can only answer the other person's offer, and only once.
  if (msg.sender_id === viewer.id) return fail("You can't answer your own offer.");
  if (msg.offer_status !== "pending") return fail("This offer was already answered.");
  await db().from("messages").update({ offer_status: accept ? "accepted" : "declined" }).eq("id", messageId);
  if (accept && m.conv.listing_id) {
    const { data: l } = await db().from("listings").select("id,seller_id,mode,deposit,status").eq("id", m.conv.listing_id).single();
    if (l && l.status === "active") {
      const buyer = l.seller_id === viewer.id ? m.other : viewer.id;
      const deliveryOtp = generateOtp();
      const { data: tx } = await db()
        .from("transactions")
        .insert({
          listing_id: l.id,
          buyer_id: buyer,
          seller_id: l.seller_id,
          kind: l.mode === "rent" ? "rental" : "sale",
          amount: msg.offer_amount,
          deposit: l.mode === "rent" ? (l.deposit ?? 0) : 0,
          delivery_otp_plain: deliveryOtp,
          delivery_otp_hash: hashOtp(deliveryOtp),
        })
        .select("id")
        .single();
      if (tx) await db().from("conversations").update({ transaction_id: tx.id }).eq("id", m.conv.id);
    }
    await db().from("messages").insert({ conversation_id: m.conv.id, sender_id: viewer.id, body: `Accepted ${fmt(msg.offer_amount)}. See you at pickup!`, listing_id: m.conv.listing_id });
  }
  await notify(m.other, "offer", "tag", `${viewer.name.split(" ")[0]} ${accept ? "accepted" : "declined"} your offer of ${fmt(msg.offer_amount)}.`, `/messages/${m.conv.id}`);
  revalidatePath("/deals");
  return ok((await getThread(m.conv.id, viewer.id))!);
}
