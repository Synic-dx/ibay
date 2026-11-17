/**
 * FEATURE: Browse and search [RUBRIC:DATA-DISPLAY] [RUBRIC:CRUD-READ]
 * WHAT: Full-text search (Postgres FTS + trigram, so "yonx" finds Yonex),
 *       filters, sorts, removable filter chips, a result count, a
 *       "Typical on campus" price insight and "Load more" pagination.
 *       All state is in the URL.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { SubBar } from "@/components/shell/mobile-bars";
import { ProductCard } from "@/features/listings/components/product-card";
import { browseListings } from "@/features/listings/queries";
import { getCategories, getCollections } from "@/features/shell/queries";
import { BrowseControls } from "@/features/browse/browse-controls";
import { browseQuery, parseBrowse } from "@/features/browse/params";
import { RequestLink } from "@/features/requests/request-link";
import { getViewer } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";
import { fmt, weeklyCost } from "@/lib/format";

type SP = Promise<Record<string, string | string[] | undefined>>;
const PAGE = 24;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const s = parseBrowse(await searchParams);
  return { title: s.q ? `"${s.q}"` : "Browse" };
}

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const s = parseBrowse(await searchParams);
  const viewer = await getViewer();
  const [{ items, total }, categories, collections, sizesRes] = await Promise.all([
    browseListings(
      {
        q: s.q, category: s.cat, modes: s.modes, near: s.near, trusted: s.trusted, ageMonths: s.age ?? undefined,
        min: s.min ? Number(s.min) : undefined, max: s.max ? Number(s.max) : undefined, size: s.size, available: s.avail,
        collection: s.coll, sort: s.sort, limit: PAGE * s.page, offset: 0,
      },
      viewer,
    ),
    getCategories(),
    getCollections(),
    (s.cat === "all" ? db().from("listings").select("size") : db().from("listings").select("size").eq("category_id", s.cat))
      .eq("status", "active")
      .not("size", "is", null)
      .limit(300),
  ]);
  const cat = categories.find((c) => c.id === s.cat);
  const coll = collections.find((c) => c.id === s.coll);
  const title = s.q ? `"${s.q}"` : coll ? coll.name : s.modes.length === 1 && !cat ? { rent: "Rentals", auction: "Live auctions", sell: "Buy", drop: "Food drops" }[s.modes[0]] : (cat?.name ?? "All categories");
  const sizes = [...new Set((sizesRes.data ?? []).map((r) => r.size as string))].slice(0, 16);

  // "Typical on campus" price range for searches (buy range and rent per week).
  const sells = items.filter((l) => l.mode === "sell" && l.price > 0).map((l) => l.price);
  const weeks = items.filter((l) => l.mode === "rent" && l.rentUnit !== "hour").map((l) => weeklyCost(l.price, l.rentUnit)!).filter(Boolean);
  const insight = s.q && items.length > 1 ? [sells.length ? `Buy ${fmt(Math.min(...sells))} to ${fmt(Math.max(...sells))}` : null, weeks.length ? `Rent ${fmt(Math.min(...weeks))} to ${fmt(Math.max(...weeks))}/week` : null].filter(Boolean) : [];

  return (
    <>
      <SubBar
        title={title}
        sub={`${total} item${total === 1 ? "" : "s"}`}
        actions={
          <Link className="ib" href={`/search${s.q ? `?q=${encodeURIComponent(s.q)}` : ""}`} aria-label="Search">
            <Icon name="search" />
          </Link>
        }
      />
      <main className="withtabs" style={{ paddingTop: 8 }}>
        <BrowseControls state={s} sizes={sizes} total={total} />
        {s.cat === "preprocess" && !s.q && (
          <div className="panel note" style={{ padding: "10px 14px", marginBottom: 12 }}>
            <Icon name="clock" />
            <span>
              Rented <b>by the hour</b>. Open an outfit, pick a day, book the free hours.
            </span>
          </div>
        )}
        {s.cat === "food" && !s.q && (
          <div className="panel note" style={{ padding: "10px 14px", marginBottom: 12 }}>
            <Icon name="home" />
            <span>
              {viewer ? (
                <>
                  Food drops in {viewer.hostel} · only people in {viewer.hostel} can see these. Change your hostel in your profile.
                </>
              ) : (
                <>
                  Food drops are <b>hostel-only</b>. Sign in to see the ones in your hostel.
                </>
              )}
            </span>
          </div>
        )}
        {s.cat === "gym" && !s.q && (
          <div className="panel note" style={{ padding: "10px 14px", marginBottom: 12 }}>
            <Icon name="dumbbell" />
            <span>The campus gym has the machines. This corner is for personal gear and supplements, with seal and expiry shown.</span>
          </div>
        )}
        {insight.length > 0 && (
          <div className="panel note" style={{ padding: "10px 14px", marginBottom: 12 }}>
            <Icon name="trend" />
            <span>Typical on campus: {insight.join(" · ")}</span>
          </div>
        )}
        <div className="agekey">
          <span className="faint">Age:</span>
          {(
            [
              ["#15803D", "<6 mo"],
              ["#02637A", "6 to 18 mo"],
              ["#E0A526", "1.5 to 3 yr"],
              ["#C2372C", "3+ yr"],
            ] as const
          ).map(([c, t]) => (
            <span key={t}>
              <i style={{ background: c }} />
              {t}
            </span>
          ))}
        </div>
        {items.length ? (
          <>
            <div className="g2">
              {items.map((l) => (
                <ProductCard key={l.id} l={l} />
              ))}
            </div>
            {items.length < total && (
              <Link className="btn sec block" style={{ marginTop: 16 }} href={`/browse${browseQuery({ ...s, page: s.page + 1 })}`} scroll={false}>
                Load more ({total - items.length} more)
                <Icon name="down" />
              </Link>
            )}
          </>
        ) : (
          <div className="empty">
            <span className="ei">
              <Icon name="search" />
            </span>
            <h3>No matches yet</h3>
            <p className="sm">Post a request and people who have it can reply.</p>
            <RequestLink href={`/requests?new=1${s.q ? `&text=${encodeURIComponent(s.q)}` : ""}`} className="btn">
              <Icon name="plus" />
              Post &quot;I am looking for...&quot;
            </RequestLink>
          </div>
        )}
      </main>
    </>
  );
}
