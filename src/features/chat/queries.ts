/**
 * FEATURE: Reading chats [RUBRIC:EXTRA]
 * WHAT: Your threads (newest first, with unread counts) and one thread with
 *       its messages, the item being discussed and the agreed deal, if any.
 * WHO: only the two members of a conversation can read it (checked here and
 *      by the RLS policy "members read messages").
 */
import "server-only";
import { db } from "@/lib/supabase/server";
import { CARD_SELECT, mapCard } from "@/features/listings/queries";
import type { ListingCard } from "@/features/listings/types";

export type ChatPerson = { id: string; name: string; hostel: string; plume: number; ratedDeals: number; avatarColor: string; avatarUrl: string | null; whatsapp: string | null };

export type ThreadSummary = {
  id: string;
  other: ChatPerson;
  listing: { id: string; title: string; deleted: boolean } | null;
  last: { body: string; kind: string; amount: number | null; mine: boolean; at: string } | null;
  unread: number;
};

export type ChatMessage = {
  id: string;
  kind: "text" | "offer" | "system";
  body: string;
  amount: number | null;
  offerStatus: "pending" | "accepted" | "declined" | "countered" | null;
  senderId: string | null;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
};

export type Thread = {
  id: string;
  other: ChatPerson;
  listing: ListingCard | null;
  deal: {
    id: string;
    amount: number;
    stage?: number;
    kind?: "sale" | "rental" | "auction";
    handoverScheduledAt?: string | null;
    handoverStatus?: "proposed" | "confirmed" | "rescheduled" | "completed";
    handoverProposedBy?: string | null;
    deliveryOtp?: string | null;
    returnOtp?: string | null;
    isBuyer?: boolean;
  } | null;
  messages: ChatMessage[];
};

const PERSON = "id,name,hostel,plume,rated_deals,avatar_color,avatar_url,whatsapp,show_whatsapp";

/* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */
const person = (p: any, showPhone: boolean): ChatPerson => ({
  id: p.id, name: p.name, hostel: p.hostel, plume: Number(p.plume), ratedDeals: p.rated_deals, avatarColor: p.avatar_color, avatarUrl: p.avatar_url,
  // WHY: WhatsApp is only shown if the person allows it and you already have a conversation.
  whatsapp: showPhone && p.show_whatsapp ? p.whatsapp : null,
});

/** Every thread for a user, newest first. */
export async function listThreads(me: string): Promise<ThreadSummary[]> {
  const { data: convs } = await db()
    .from("conversations")
    .select(`id,user_a,user_b,last_message_at,a:profiles!conversations_user_a_fkey(${PERSON}),b:profiles!conversations_user_b_fkey(${PERSON}),listing:listings(id,title,status)`)
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("last_message_at", { ascending: false })
    .limit(100);
  const ids = (convs ?? []).map((c: any) => c.id as string);
  if (!ids.length) return [];
  const { data: msgs } = await db()
    .from("messages")
    .select("conversation_id,body,kind,offer_amount,sender_id,created_at,read_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(1000);
  const last = new Map<string, any>();
  const unread = new Map<string, number>();
  for (const m of msgs ?? []) {
    if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
    if (m.sender_id !== me && !m.read_at) unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
  }
  return (convs ?? []).map((c: any) => {
    const m = last.get(c.id);
    return {
      id: c.id,
      other: person(c.user_a === me ? c.b : c.a, true),
      listing: c.listing ? { id: c.listing.id, title: c.listing.title, deleted: c.listing.status === "deleted" } : null,
      last: m ? { body: m.body, kind: m.kind, amount: m.offer_amount, mine: m.sender_id === me, at: m.created_at } : null,
      unread: unread.get(c.id) ?? 0,
    };
  });
}

/**
 * One thread. Marks the other person's messages as read.
 * @returns null if it doesn't exist or you are not a member (the page shows 404)
 */
export async function getThread(id: string, me: string, dealId?: string | null): Promise<Thread | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: c } = await db()
    .from("conversations")
    .select(`id,user_a,user_b,listing_id,transaction_id,a:profiles!conversations_user_a_fkey(${PERSON}),b:profiles!conversations_user_b_fkey(${PERSON}),tx:transactions(id,amount,stage,kind,buyer_id,seller_id,handover_scheduled_at,handover_status,handover_proposed_by,delivery_otp_plain,return_otp_plain)`)
    .eq("id", id)
    .maybeSingle();
  const conv = c as any;
  if (!conv || (conv.user_a !== me && conv.user_b !== me)) return null;

  let activeTx = conv.tx;
  let activeListingId = conv.listing_id;
  if (dealId && /^[0-9a-f-]{36}$/i.test(dealId) && conv.transaction_id !== dealId) {
    const { data: specifiedTx } = await db()
      .from("transactions")
      .select("id,amount,stage,kind,buyer_id,seller_id,listing_id,handover_scheduled_at,handover_status,handover_proposed_by,delivery_otp_plain,return_otp_plain")
      .eq("id", dealId)
      .maybeSingle();
    if (specifiedTx && (specifiedTx.buyer_id === me || specifiedTx.seller_id === me)) {
      activeTx = specifiedTx;
      if (specifiedTx.listing_id) activeListingId = specifiedTx.listing_id;
      await db().from("conversations").update({ transaction_id: dealId, ...(specifiedTx.listing_id ? { listing_id: specifiedTx.listing_id } : {}) }).eq("id", id);
    }
  }

  const [{ data: msgs }, listingRes] = await Promise.all([
    db().from("messages").select("id,kind,body,offer_amount,offer_status,sender_id,created_at,read_at").eq("conversation_id", id).order("created_at").limit(500),
    activeListingId ? db().from("listings").select(CARD_SELECT).eq("id", activeListingId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await db().from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_id", me).is("read_at", null);
  return {
    id,
    other: person(conv.user_a === me ? conv.b : conv.a, true),
    listing: listingRes.data ? mapCard(listingRes.data) : null,
    deal: activeTx
      ? {
          id: activeTx.id,
          amount: activeTx.amount,
          stage: activeTx.stage,
          kind: activeTx.kind,
          handoverScheduledAt: activeTx.handover_scheduled_at ?? null,
          handoverStatus: activeTx.handover_status ?? "proposed",
          handoverProposedBy: activeTx.handover_proposed_by ?? null,
          deliveryOtp: activeTx.buyer_id === me ? (activeTx.delivery_otp_plain ?? null) : null,
          returnOtp: activeTx.buyer_id === me ? (activeTx.return_otp_plain ?? null) : null,
          isBuyer: activeTx.buyer_id === me,
        }
      : null,
    messages: (msgs ?? []).map((m: any) => ({
      id: m.id, kind: m.kind, body: m.body, amount: m.offer_amount, offerStatus: m.offer_status, senderId: m.sender_id,
      mine: m.sender_id === me, createdAt: m.created_at, readAt: m.read_at,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
