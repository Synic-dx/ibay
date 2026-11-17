/**
 * FEATURE: Deals (the "Your deals" tab with a step tracker)
 * WHAT: Every deal you are part of, as buyer or seller, with the item, the
 *       other person, the current step and whether you have rated it.
 * STEPS: Sale: Agreed -> Handed over -> Rate. Rental: Agreed -> Picked up -> Returned -> Rate.
 */
import "server-only";
import { db } from "@/lib/supabase/server";
import { CARD_SELECT, mapCard } from "@/features/listings/queries";

export { canRate, stagesFor, type Deal } from "./stages";
import type { Deal } from "./stages";
import { canRate } from "./stages";

/** All deals for a user, newest first. */
export async function listDeals(userId: string): Promise<Deal[]> {
  const { data } = await db()
    .from("transactions")
    .select(
      "id,kind,amount,deposit,stage,created_at,buyer_id,seller_id," +
        "buyer:profiles!transactions_buyer_id_fkey(id,name,plume,rated_deals,hostel),seller:profiles!transactions_seller_id_fkey(id,name,plume,rated_deals,hostel)," +
        `listing:listings(${CARD_SELECT})`,
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  const ids = (data ?? []).map((d) => (d as unknown as { id: string }).id);
  const { data: ratings } = ids.length
    ? await db().from("ratings").select("transaction_id,score,editable_until,reason,tags").eq("rater_id", userId).in("transaction_id", ids)
    : { data: [] };
  const mine = new Map((ratings ?? []).map((r) => [r.transaction_id as string, r]));
  /* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */
  return (data ?? []).map((raw) => {
    const d = raw as any;
    const role: "buyer" | "seller" = d.buyer_id === userId ? "buyer" : "seller";
    const o = role === "buyer" ? d.seller : d.buyer;
    const r = mine.get(d.id);
    return {
      id: d.id,
      kind: d.kind,
      role,
      amount: d.amount,
      deposit: d.deposit,
      stage: d.stage,
      createdAt: d.created_at,
      listing: mapCard(d.listing),
      other: { id: o.id, name: o.name, plume: Number(o.plume), ratedDeals: o.rated_deals, hostel: o.hostel },
      myRating: r ? { score: r.score, editableUntil: r.editable_until, reason: r.reason, tags: r.tags } : null,
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** How many finished deals are still waiting for your rating. */
export async function pendingRatingCount(userId: string): Promise<number> {
  const deals = await listDeals(userId);
  return deals.filter((d) => canRate(d) && !d.myRating).length;
}
