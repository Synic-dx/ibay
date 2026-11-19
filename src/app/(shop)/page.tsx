/**
 * FEATURE: Home (the store, open to everyone) [RUBRIC:DATA-DISPLAY] [RUBRIC:RESPONSIVE]
 * WHAT: hero carousel + side cards, "Ending soon" board, reassurance strip,
 *       category tiles (desktop) / stories (phone), "Shop by moment",
 *       rails (Big brands, Preprocess, Gym Corner, Novels & manga, Rent don't buy),
 *       "People are looking for" and "Fresh near you".
 */
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { RootBar, SearchPill } from "@/components/shell/mobile-bars";
import { LiveStrip } from "@/components/shell/live-strip";
import { HostelButton } from "@/features/home/hostel-button";
import { HeroCarousel, HeroSide } from "@/features/home/hero";
import { EndingBoard } from "@/features/home/ending-board";
import { CategoryPic } from "@/features/home/category-pic";
import { ProductCard } from "@/features/listings/components/product-card";
import { canSeeDrop, visibleCatalogue } from "@/features/listings/queries";
import { getCategories, getCollections, getLiveItems, inCollection } from "@/features/shell/queries";
import { listRequests } from "@/features/requests/queries";
import { pendingRatingCount } from "@/features/deals/queries";
import { getViewer } from "@/lib/auth/session";
import { dbReady } from "@/lib/supabase/server";
import { dayLabel, dayOffsetOf, offPct } from "@/lib/format";
import type { ListingCard } from "@/features/listings/types";
import { RequestLink } from "@/features/requests/request-link";
import { SetupNotice } from "@/components/setup-notice";

const STORIES: [string, string, boolean, string][] = [
  ["preprocess", "Getups", true, "/browse?cat=preprocess"],
  ["gym", "Gym", true, "/browse?cat=gym"],
  ["food", "Food drops", true, "/browse?cat=food"],
  ["auction", "Auctions", false, "/browse?modes=auction"],
  ["rent", "Rentals", false, "/browse?modes=rent"],
  ["reads", "Manga & novels", false, "/browse?cat=reads"],
  ["exam", "CFA & CAT", false, "/browse?cat=exam"],
  ["free", "Free", false, "/browse?cat=free"],
  ["formals", "Formals", false, "/browse?cat=formals"],
  ["gadgets", "Gadgets", false, "/browse?cat=gadgets"],
  ["all", "All", false, "/explore"],
];

function Rail({ icon, title, sub, items, more }: { icon: string; title: string; sub?: string; items: ListingCard[]; more: string }) {
  if (!items.length) return null;
  return (
    <section className="sec">
      <div className="sh">
        <h2>
          <Icon name={icon} />
          {title}
        </h2>
        <Link href={more}>
          See all
          <Icon name="chev" />
        </Link>
      </div>
      {sub && <div className="sub">{sub}</div>}
      <div className="hrail">
        {items.map((l) => (
          <ProductCard key={l.id} l={l} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  if (!dbReady()) return <SetupNotice />;
  const viewer = await getViewer();
  const [catalogue, categories, collections, live, requests, pending] = await Promise.all([
    visibleCatalogue(viewer),
    getCategories(),
    getCollections(),
    getLiveItems(viewer),
    listRequests("urgent", viewer?.id, 20),
    viewer ? pendingRatingCount(viewer.id) : Promise.resolve(0),
  ]);
  // Not your own listings, and food drops only from your hostel.
  const act = catalogue.filter((l) => l.seller.id !== viewer?.id && canSeeDrop(l, viewer));
  const near = (l: ListingCard) => (viewer && l.pickupHostel === viewer.hostel ? 1 : 0);
  const deals = act.filter((l) => l.mode === "sell" && l.brand && (offPct(l.price, l.mrp) ?? 0) >= 45).sort((a, b) => (offPct(b.price, b.mrp) ?? 0) - (offPct(a.price, a.mrp) ?? 0));
  const rent = act.filter((l) => l.mode === "rent" && ["appliances", "exam", "gadgets", "travel", "events", "sports"].includes(l.categoryId));
  const fresh = [...act].sort((a, b) => near(b) - near(a) || b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const topRequest = [...requests].sort((a, b) => b.votes - a.votes)[0] ?? null;
  const countBy = new Map<string, number>();
  for (const l of catalogue) countBy.set(l.categoryId, (countBy.get(l.categoryId) ?? 0) + 1);
  const storyPic = (k: string) => {
    if (k === "auction") return <img src="/img/puffer.webp" alt="" />; // eslint-disable-line @next/next/no-img-element
    if (k === "rent") return <img src="/img/cooler.webp" alt="" />; // eslint-disable-line @next/next/no-img-element
    const c = categories.find((x) => x.id === k);
    return c ? <CategoryPic c={c} /> : <Icon name="grid" className="icon i28" />;
  };

  return (
    <>
      <RootBar>
        <LiveStrip drops={live.drops} auctions={live.auctions} />
        <HostelButton />
        <SearchPill />
      </RootBar>
      <main className="withtabs">
        <nav className="stories" aria-label="Quick categories">
          {STORIES.map(([k, n, hot, href]) => (
            <Link key={k} className={`story ${hot ? "hot" : ""}`} href={href}>
              <span className="ring">
                <span>{storyPic(k)}</span>
              </span>
              {n}
            </Link>
          ))}
        </nav>

        <section className="sec herogrid" style={{ marginTop: 14 }}>
          <HeroCarousel />
          <HeroSide topRequest={topRequest} openRequests={requests.length} pendingRatings={pending} />
        </section>

        <EndingBoard drops={live.drops} auctions={live.auctions} allDrops={live.allDrops} />

        <div className="vprops">
          {(
            [
              ["shield", "Only IIM Indore", "Every account is a verified @iimidr.ac.in email"],
              ["wallet", "Pay at handover", "UPI or cash when you meet. Nothing charged online"],
              ["pin", "Pickup from your hostel", "Filter by your hostel and walk over"],
              ["star", "Ratings after every deal", "Both sides rate, and it builds their Plume"],
            ] as const
          ).map(([i, t, d]) => (
            <div className="vp" key={t}>
              <Icon name={i} />
              <span>
                <b>{t}</b>
                <span>{d}</span>
              </span>
            </div>
          ))}
        </div>

        <section className="sec dcatsec">
          <div className="sh">
            <h2>
              <Icon name="grid" />
              Shop by category
            </h2>
            <Link href="/explore">
              All categories
              <Icon name="chev" />
            </Link>
          </div>
          <div className="ctiles">
            {categories.map((c) => (
              <Link key={c.id} className="ctile" href={`/browse?cat=${c.id}`}>
                <span className="ci">
                  <CategoryPic c={c} />
                </span>
                <b>{c.short}</b>
                <span className="xs faint">{countBy.get(c.id) ?? 0} items</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="sh">
            <h2>
              <Icon name="sparkles" />
              Shop by moment
            </h2>
          </div>
          <div className="hrail" style={{ gridAutoColumns: "220px" }}>
            {/* eslint-disable @next/next/no-img-element -- small local thumbnails */}
            {collections.map((c) => {
              const its = catalogue.filter((l) => inCollection(l, c));
              return (
                <Link key={c.id} className="panel moment" href={`/browse?coll=${c.id}`}>
                  <div className="th3">
                    {its.slice(0, 3).map((l) => (
                      <span key={l.id}>{l.photo ? <img src={l.photo.url} alt="" className={l.photo.fit === "cover" ? "cover" : ""} /> : <Icon name="ticket" />}</span>
                    ))}
                  </div>
                  <div>
                    <b className="sm">{c.name}</b>
                    <div className="faint xs">{its.length} items</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <Rail icon="tag" title="Hot Deals & Heavy Discounts" sub="Original price vs what it is going for now" items={deals.slice(0, 10)} more="/browse?sort=off" />
        <Rail icon="drama" title="Getups & Costumes" sub="For club and committee interviews, preprocesses and presentations. Rent by the hour." items={act.filter((l) => l.categoryId === "preprocess")} more="/browse?cat=preprocess" />
        <Rail icon="dumbbell" title="Gym Corner" items={act.filter((l) => l.categoryId === "gym")} more="/browse?cat=gym" />
        <Rail icon="book" title="Novels, comics & manga" sub="Buy or rent by the week" items={act.filter((l) => l.categoryId === "reads")} more="/browse?cat=reads" />
        <Rail icon="repeat" title="Rent, don't buy" sub="Coolers, calculators, speakers, cycles" items={rent} more="/browse?modes=rent" />

        {requests.length > 0 && (
          <section className="sec">
            <div className="sh">
              <h2>
                <Icon name="list" />
                People are looking for
              </h2>
              <RequestLink href="/requests" className="">
                All
                <Icon name="chev" />
              </RequestLink>
            </div>
            <div className="hrail reqrail" style={{ gridAutoColumns: "78%" }}>
              {requests.slice(0, 4).map((r) => {
                const off = r.neededBy ? dayOffsetOf(r.neededBy) : null;
                return (
                  <RequestLink key={r.id} href={`/requests/${r.id}`} className="panel pad stack" style={{ gap: 6, textAlign: "left" }}>
                    <div className="row xs faint">
                      <Avatar name={r.author.name} url={r.author.avatarUrl} color={r.author.avatarColor} size={20} />
                      {r.author.name.split(" ")[0]} · {r.author.hostel}
                    </div>
                    <b style={{ fontSize: 14 }}>&quot;{r.text}&quot;</b>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {off != null && (
                        <span className={`badge ${off <= 2 ? "b-drop" : "b-neutral"}`}>
                          <Icon name="cal" />
                          By {dayLabel(off, true)}
                        </span>
                      )}
                      <span className="faint xs">{r.budget}</span>
                    </div>
                    <span className="sm" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                      I have this ›
                    </span>
                  </RequestLink>
                );
              })}
            </div>
          </section>
        )}

        <section className="sec">
          <div className="sh">
            <h2>
              <Icon name="pin" />
              {viewer ? `Fresh in ${viewer.hostel} and around` : "Fresh on campus"}
            </h2>
          </div>
          <div className="g2">
            {fresh.map((l) => (
              <ProductCard key={l.id} l={l} />
            ))}
          </div>
          <Link className="btn sec block" style={{ marginTop: 14 }} href="/browse?sort=new">
            Browse everything
            <Icon name="arrow" />
          </Link>
        </section>
        <p className="faint xs" style={{ textAlign: "center", marginTop: 26 }}>
          i-bay · IIM Indore&apos;s campus marketplace · pay at handover, nothing charged online
        </p>
      </main>
    </>
  );
}
