/**
 * FEATURE: Public seller profile: Plume in words, listings and reviews.
 * LAYOUT: two columns on desktop (profile card | listings and reviews).
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { SubBar } from "@/components/shell/mobile-bars";
import { getViewer } from "@/lib/auth/session";
import { trustLevel } from "@/lib/plume";
import { getProfile, reviewsFor } from "@/features/profile/queries";
import { ReviewRow } from "@/features/profile/review-row";
import { ProductCard } from "@/features/listings/components/product-card";
import { CARD_SELECT, mapCard, savedIds } from "@/features/listings/queries";
import { db } from "@/lib/supabase/server";
import { MessageButton } from "@/features/profile/message-button";
import { ReportButton } from "@/features/admin/report-sheet";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const viewer = await getViewer();
  const u = await getProfile(id);
  if (!u) notFound();
  const [reviews, { data }, saved] = await Promise.all([
    reviewsFor(id),
    db()
      .from("listings")
      .select(CARD_SELECT)
      .eq("seller_id", id)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("mode", "drop")
      .order("created_at", { ascending: false })
      .limit(60),
    savedIds(viewer?.id),
  ]);
  const listings = (data ?? []).map((r) => mapCard(r, saved));
  const t = trustLevel(u.plume, u.ratedDeals);
  const pos = reviews.filter((r) => r.score > 0).length;
  const showReviews = tab === "reviews";
  return (
    <>
      <SubBar title={u.name} sub={u.hostel} />
      <main className="withtabs">
        {/* Desktop: profile card on the left, listings / reviews on the right. Phones: one column. */}
        <div className="profcols">
          <div
            className="panel pad stack profcard"
            style={{ alignItems: "center", textAlign: "center", gap: 8 }}
          >
            <Avatar
              name={u.name}
              url={u.avatarUrl}
              color={u.avatarColor}
              size={76}
            />
            <h2>{u.name}</h2>
            <span className="sm muted">
              {u.hostel} · since {u.since}
            </span>
            {u.responseNote && (
              <span className="xs faint row" style={{ gap: 4 }}>
                <Icon name="clock" className="icon i14" />
                {u.responseNote}
              </span>
            )}
            <div
              className="row"
              style={{ gap: 0, width: "100%", marginTop: 8 }}
            >
              <div style={{ flex: 1 }}>
                <div className="faint xs">Plume</div>
                <b style={{ fontSize: 20 }}>
                  {u.plume > 0 ? "+" : ""}
                  {Math.round(u.plume)}
                </b>
              </div>
              <div style={{ flex: 1 }}>
                <div className="faint xs">Level</div>
                <b className={`trust ${t.tone}`} style={{ fontSize: 13 }}>
                  {t.label}
                </b>
              </div>
              <div style={{ flex: 1 }}>
                <div className="faint xs">Deals</div>
                <b style={{ fontSize: 20 }}>{u.ratedDeals}</b>
              </div>
            </div>
            {viewer?.id !== u.id && (
              <>
                <MessageButton userId={u.id} />
                <ReportButton userId={u.id} label="Report this person" />
              </>
            )}
          </div>
          <div className="profmain">
            <nav
              className="seg"
              style={{ margin: "16px 0" }}
              aria-label="Profile tabs"
            >
              {(
                [
                  ["listings", `Listings (${listings.length})`],
                  ["reviews", `Reviews (${reviews.length})`],
                ] as const
              ).map(([k, n]) => (
                <Link
                  key={k}
                  href={`/u/${u.id}${k === "reviews" ? "?tab=reviews" : ""}`}
                  aria-current={
                    (k === "reviews") === showReviews ? "page" : undefined
                  }
                  style={{
                    flex: 1,
                    minHeight: 38,
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      (k === "reviews") === showReviews
                        ? "var(--brand-ink)"
                        : "var(--ink-2)",
                    background:
                      (k === "reviews") === showReviews
                        ? "var(--surface)"
                        : undefined,
                    boxShadow:
                      (k === "reviews") === showReviews
                        ? "var(--shr)"
                        : undefined,
                  }}
                >
                  {n}
                </Link>
              ))}
            </nav>
            {showReviews ? (
              <div className="panel pad">
                <div className="faint xs" style={{ marginBottom: 4 }}>
                  {pos} positive · {reviews.length - pos} negative
                </div>
                {reviews.length ? (
                  reviews.map((r) => <ReviewRow key={r.id} r={r} />)
                ) : (
                  <p className="faint sm">No reviews yet.</p>
                )}
              </div>
            ) : listings.length ? (
              <div className="g2">
                {listings.map((l) => (
                  <ProductCard key={l.id} l={l} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <span className="ei">
                  <Icon name="store" />
                </span>
                <h3>Nothing listed</h3>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
