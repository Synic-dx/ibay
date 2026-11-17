/**
 * FEATURE: /item/[id], one listing [RUBRIC:CRUD-READ]
 * WHO: everyone can open active listings; owners also see paused, sold and
 *      deleted ones (with Restore in My listings). Food drops only open for
 *      people in the same hostel. Anything not visible is a 404.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";
import { getListingDetail, similarListings, typicalPrice } from "@/features/listings/queries";
import { getCategories } from "@/features/shell/queries";
import { ItemView, type Review } from "@/features/item/item-view";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const l = await getListingDetail(id, await getViewer());
  return l ? { title: l.title, description: `${fmt(l.price)} on i-bay, IIM Indore's campus marketplace.` } : { title: "Not found" };
}

export default async function ItemPage({ params, searchParams }: P) {
  const { id } = await params;
  const { sheet } = await searchParams;
  const viewer = await getViewer();
  const l = await getListingDetail(id, viewer);
  if (!l) notFound();
  const mine = viewer?.id === l.seller.id;

  const [similar, typical, categories, ratings, ratingCount, convs, audit, upcoming] = await Promise.all([
    similarListings(l, viewer),
    typicalPrice(l),
    getCategories(),
    db().from("ratings").select("id,score,reason,tags,created_at,rater:profiles!ratings_rater_id_fkey(name)").eq("ratee_id", l.seller.id).order("created_at", { ascending: false }).limit(2),
    db().from("ratings").select("id", { count: "exact", head: true }).eq("ratee_id", l.seller.id),
    mine
      ? db().from("conversations").select("user_a,user_b,a:profiles!conversations_user_a_fkey(id,name,hostel,avatar_color),b:profiles!conversations_user_b_fkey(id,name,hostel,avatar_color)").eq("listing_id", id)
      : Promise.resolve({ data: [] }),
    mine ? db().from("audit_log").select("action,after,created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    mine && l.mode === "rent"
      ? db().from("rental_bookings").select("id", { count: "exact", head: true }).eq("listing_id", id).eq("status", "confirmed").filter("period", "ov", `[${new Date().toISOString()},)`)
      : Promise.resolve({ count: 0 }),
  ]);

  // Count the view after the response is sent (not for the owner).
  if (!mine) after(async () => void (await db().rpc("increment_listing_views", { p_listing: id })));

  const cat = categories.find((c) => c.id === l.categoryId);
  /* eslint-disable @typescript-eslint/no-explicit-any -- joined PostgREST rows */
  const reviews: Review[] = (ratings.data ?? []).map((r: any) => ({ id: r.id, score: r.score, reason: r.reason, tags: r.tags, raterName: r.rater?.name ?? "Deleted user", createdAt: r.created_at }));
  const chatters = (convs.data ?? []).map((c: any) => {
    const o = c.user_a === viewer?.id ? c.b : c.a;
    return { id: o.id, name: o.name, hostel: o.hostel, avatarColor: o.avatar_color };
  });
  const history = (audit.data ?? []).map((a: any) => ({
    at: a.created_at,
    changes: a.action === "update" ? Object.keys(a.after ?? {}).filter((k) => !["price_drop_amount", "price_dropped_at", "status_before_delete", "deleted_at"].includes(k)).join(", ").replace(/_/g, " ") : a.action === "create" ? "listed" : a.action === "delete" ? "deleted" : "restored",
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <ItemView
      l={l}
      similar={similar}
      typical={typical}
      reviews={reviews}
      reviewCount={ratingCount.count ?? 0}
      categoryShort={cat?.short ?? ""}
      categoryIcon={cat?.icon ?? "pkg"}
      chatters={chatters}
      history={history}
      upcomingBookings={(upcoming.count ?? 0) > 0}
      initialSheet={sheet ?? null}
    />
  );
}
