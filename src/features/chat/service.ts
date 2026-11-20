/**
 * FEATURE: Chat helpers used by other server code (not callable from the browser)
 * WHAT: find-or-create the one thread between two people, add messages, and
 *       send a realtime "ping" so the other person's screen refreshes.
 * WHY a separate file: anything exported from a "use server" file becomes an
 *       endpoint. These helpers take user ids as arguments, so they must stay
 *       server-only and be called only after the session was checked.
 */
import "server-only";
import { db } from "@/lib/supabase/server";
import { userChannel } from "@/lib/auth/ticket";
import { env } from "@/lib/env";

/**
 * Sends a content-free realtime ping to people (Supabase Realtime broadcast).
 * The browser then re-fetches through our authorised server code, so no
 * message text ever travels over the public channel.
 */
export async function ping(userIds: string[], kind: "message" | "notification" | "bid" = "message"): Promise<void> {
  if (!env.supabaseUrl || !env.supabaseServiceKey || !userIds.length) return;
  await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: env.supabaseServiceKey, Authorization: `Bearer ${env.supabaseServiceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [...new Set(userIds)].map((id) => ({ topic: userChannel(id), event: "ping", payload: { kind } })) }),
  }).catch(() => undefined);
}

/**
 * Tells everyone viewing an auction page that something changed (new bid,
 * bought, ended). Content-free: their browser re-fetches the page.
 * @param listingId the auction
 */
export async function pingListing(listingId: string): Promise<void> {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return;
  await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: env.supabaseServiceKey, Authorization: `Bearer ${env.supabaseServiceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ topic: `listing-${listingId}`, event: "bid", payload: {} }] }),
  }).catch(() => undefined);
}

/**
 * The thread between two people (created on first contact).
 * @param me the signed-in user (already authenticated by the caller)
 * @param other the person they are talking to
 * @param listingId the item they are talking about (updates the context strip)
 * @param firstMessage optional message to send straight away
 * @param transactionId optional deal to attach (shows the "Deal agreed" bar)
 * @returns the conversation id, or null if it couldn't be created
 */
export async function startConversation(me: string, other: string, listingId?: string | null, firstMessage?: string, transactionId?: string | null): Promise<string | null> {
  if (me === other) return null;
  const [a, b] = [me, other].sort();
  const { data: existing } = await db().from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await db().from("conversations").insert({ user_a: a, user_b: b, listing_id: listingId ?? null, transaction_id: transactionId ?? null }).select("id").single();
    if (error) return null;
    id = data.id as string;
  } else if (listingId || transactionId) {
    await db()
      .from("conversations")
      .update({ ...(listingId ? { listing_id: listingId } : {}), ...(transactionId ? { transaction_id: transactionId } : {}) })
      .eq("id", id);
  }
  if (firstMessage) {
    await db().from("messages").insert({ conversation_id: id, sender_id: me, body: firstMessage.slice(0, 1000), listing_id: listingId ?? null });
    await ping([other]);
  }
  return id;
}

/** Adds a notification (bell) and pings the person. */
export async function notify(userId: string, kind: string, icon: string, body: string, link: string | null): Promise<void> {
  await db().from("notifications").insert({ user_id: userId, kind, icon, body, link });
  await ping([userId], "notification");
}
