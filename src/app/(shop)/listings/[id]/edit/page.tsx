/**
 * FEATURE: /listings/[id]/edit, update a listing [RUBRIC:CRUD-UPDATE]
 * WHO: only the owner. Anyone else gets a 404 (not a 403).
 * WHY 404: so people can't guess which listing ids exist.
 * SHOWS: the same 3-step form prefilled, locked fields with reasons, the edit
 *        history from audit_log and a red "Delete listing" danger zone.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";
import { getCategories } from "@/features/shell/queries";
import { getListingDetail } from "@/features/listings/queries";
import { ListingForm } from "@/features/listings/listing-form/listing-form";
import { valuesFromListing } from "@/features/listings/form-values";
import { SubBar } from "@/components/shell/mobile-bars";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";

export const metadata: Metadata = { title: "Edit listing" };

const FIELD_NAMES: Record<string, string> = {
  price: "price", title: "title", description: "description", mrp: "original price", condition: "condition", status: "status",
  deposit: "deposit", rent_unit: "unit", category_id: "category", photos: "photos", purchased_on: "purchase month", ends_at: "end time",
  size: "size", brand: "brand", model: "model", specs: "specs", is_bundle: "bundle", bundle_contents: "bundle contents",
};

/** "price ₹4,200 → ₹3,900, description" from an audit row. */
function describe(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const keys = Object.keys(after ?? {}).filter((k) => FIELD_NAMES[k]);
  return keys
    .map((k) =>
      k === "price" && before?.price != null
        ? `price ${fmt(Number(before.price))} → ${fmt(Number(after!.price))}`
        : k === "status"
          ? `${String(before?.status ?? "")} → ${String(after!.status)}`
          : FIELD_NAMES[k],
    )
    .join(", ");
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/listings/${id}/edit`);
  const l = await getListingDetail(id, viewer);
  // Owner only: everyone else sees "not found".
  if (!l || l.seller.id !== viewer.id || l.status === "deleted") notFound();

  if (!["active", "paused"].includes(l.status)) {
    return (
      <>
        <SubBar title="Edit listing" />
        <main>
          <div className="empty">
            <span className="ei">
              <Icon name="lock" />
            </span>
            <h3>This listing is {l.status}</h3>
            <p className="sm">Sold or ended listings are read-only. Relist it from My listings to post a fresh copy.</p>
            <Link className="btn" href="/my-listings?tab=sold">
              Go to My listings
            </Link>
          </div>
        </main>
      </>
    );
  }

  const [categories, { data: audit }, { count: upcoming }] = await Promise.all([
    getCategories(),
    db().from("audit_log").select("action,before,after,created_at").eq("entity", "listing").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
    db().from("rental_bookings").select("id", { count: "exact", head: true }).eq("listing_id", id).eq("status", "confirmed").filter("period", "ov", `[${new Date().toISOString()},)`),
  ]);
  const history = (audit ?? [])
    .map((a) => ({ at: a.created_at as string, changes: a.action === "update" ? describe(a.before, a.after) : a.action === "create" ? "listed" : a.action === "delete" ? "deleted" : "restored" }))
    .filter((h) => h.changes);

  return (
    <ListingForm
      categories={categories}
      initial={valuesFromListing(l) as never}
      edit={{ id: l.id, bids: l.bidCount, bookedAhead: (upcoming ?? 0) > 0, status: l.status, createdAt: l.createdAt, history, card: l }}
    />
  );
}
