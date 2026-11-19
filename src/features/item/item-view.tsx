"use client";
/**
 * FEATURE: Item page [RUBRIC:CRUD-READ] [RUBRIC:RESPONSIVE]
 * WHAT: Sticky gallery (left on tablet/desktop), then one combined price + buy
 *       panel: asking price, % below original, age badge, a facts row
 *       (original price, bought), one big primary button and two
 *       secondary ones (Make an offer, Chat), and a pay-at-handover note.
 *       Owners get Edit / Pause / Delete instead of buying.
 *       Below: seller card, quick questions, bundles, edit history, details,
 *       description, reviews and similar items. Phones get a sticky action bar.
 * LIVE: auctions refresh instantly when anyone bids (Supabase Realtime).
 */
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { Countdown } from "@/components/countdown";
import { useApp } from "@/components/app-context";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { ago, ageMonths, ageText, boughtLabel, fmt, nextBid, offPct, unitShort, unitWord } from "@/lib/format";
import { browserClient } from "@/lib/supabase/browser";
import { ProductCard } from "@/features/listings/components/product-card";
import { AgeBadge, ModeBadge, PhotoTile, TrustLine, hasAge } from "@/features/listings/components/parts";
import { DeleteDialog } from "@/features/listings/delete-dialog";
import { setPaused, relistListing } from "@/features/listings/actions/update";
import { toggleSave } from "@/features/listings/actions/save";
import { claimDrop } from "@/features/drops/actions";
import { useOpenChat } from "@/features/chat/use-open-chat";
import { DatesSheet, HoursSheet } from "@/features/rentals/booking-sheets";
import { ReportButton } from "@/features/admin/report-sheet";
import { BidSheet, BuySheet, CloseAuctionSheet, OfferSheet, SoldSheet } from "./sheets";
import PickupSnippet from "@/features/map/components/pickup-snippet";
import { findNearestResidence, getResidenceCoordinates, calculateDistanceMeters } from "@/features/map/proximity";
import type { ListingCard, ListingDetail } from "@/features/listings/types";

export type Review = { id: string; score: number; reason: string; tags: string[]; raterName: string; createdAt: string };
type SheetKey = "bid" | "buy" | "offer" | "dates" | "hours" | "del" | "close" | "sold" | null;

type Props = {
  l: ListingDetail;
  similar: ListingCard[];
  typical: { lo: number; hi: number } | null;
  reviews: Review[];
  reviewCount: number;
  categoryShort: string;
  categoryIcon: string;
  chatters: { id: string; name: string; hostel: string; avatarColor: string }[];
  history: { at: string; changes: string }[];
  upcomingBookings: boolean;
  initialSheet: string | null;
};

function RevRow({ r }: { r: Review }) {
  return (
    <div className="review">
      <span className={`score ${r.score > 3 ? "s-good" : r.score < -3 ? "s-bad" : "s-mid"}`}>
        {r.score > 0 ? "+" : ""}
        {r.score}
      </span>
      <div className="sm" style={{ flex: 1 }}>
        <div>{r.reason}</div>
        {r.tags.length > 0 && (
          <div className="chips" style={{ marginTop: 6, gap: 4 }}>
            {r.tags.map((t) => (
              <span key={t} className="badge b-neutral">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="faint xs" style={{ marginTop: 4 }}>
          {r.raterName} · {ago(r.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function ItemView({ l, similar, typical, reviews, reviewCount, categoryShort, categoryIcon, chatters, history, upcomingBookings, initialSheet }: Props) {
  const { viewer, openAuth } = useApp();
  const router = useRouter();
  const { open: openChat, pending: chatPending } = useOpenChat();
  const [sheet, setSheet] = useState<SheetKey>((["bid", "buy", "offer", "dates", "hours", "close", "sold"].includes(initialSheet ?? "") ? initialSheet : null) as SheetKey);
  const [saved, setSaved] = useState(l.saved);
  const [slide, setSlide] = useState(0);
  const [pending, start] = useTransition();
  const trackRef = useRef<HTMLDivElement>(null);
  const mine = viewer?.id === l.seller.id;
  const s = l.seller;
  const first = s.name.split(" ")[0];

  const scrollToSlide = (idx: number) => {
    setSlide(idx);
    if (trackRef.current) {
      trackRef.current.scrollTo({
        left: idx * trackRef.current.clientWidth,
        behavior: "smooth",
      });
    }
  };

  const effectivePickupHostel = useMemo(() => {
    if (l.pickupLat && l.pickupLng) {
      const res = findNearestResidence(l.pickupLat, l.pickupLng);
      if (res && res.distanceMeters <= 80) {
        return res.location.name;
      }
    }
    return l.pickupHostel;
  }, [l.pickupLat, l.pickupLng, l.pickupHostel]);

  const near = useMemo(() => {
    if (!viewer?.hostel || mine) return false;
    if (l.pickupLat && l.pickupLng) {
      const vCoords = getResidenceCoordinates(viewer.hostel);
      if (vCoords) {
        const d = calculateDistanceMeters(vCoords.lat, vCoords.lng, l.pickupLat, l.pickupLng);
        return d <= 55;
      }
    }
    return viewer.hostel.trim().toLowerCase() === effectivePickupHostel.trim().toLowerCase();
  }, [viewer?.hostel, effectivePickupHostel, mine, l.pickupLat, l.pickupLng]);

  const available = l.status === "active" || (mine && l.status === "paused");
  const m = ageMonths(l.purchasedOn);

  // Live auctions and timers: refresh when a bid lands or the listing changes.
  useEffect(() => {
    const sb = browserClient();
    if (!sb || (l.mode !== "auction" && l.mode !== "drop")) return;
    const ch = sb
      .channel(`listing-${l.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `listing_id=eq.${l.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${l.id}` }, () => router.refresh())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [l.id, l.mode, router]);

  const gate = (reason: string, fn: () => void) => () => (viewer ? fn() : openAuth({ reason, next: `/item/${l.id}` }));
  const heart = gate("Sign in to save items and get price drop alerts", () =>
    start(async () => {
      setSaved(!saved);
      const r = await toggleSave(l.id);
      if (r.ok) toast(r.message);
      else setSaved(saved);
    }),
  );
  const claim = gate("Sign in to claim this food drop", () =>
    start(async () => {
      const r = await claimDrop(l.id);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      router.push(r.data.conversationId ? `/messages/${r.data.conversationId}` : "/deals");
    }),
  );
  const pause = () =>
    start(async () => {
      const r = await setPaused(l.id, l.status !== "paused");
      if (r.ok) toast(r.message);
      else toast.error(r.formError);
      router.refresh();
    });
  const relist = () =>
    start(async () => {
      const r = await relistListing(l.id);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      router.push(`/listings/${r.data.id}/edit`);
    });
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: l.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied to share on WhatsApp");
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  // Gallery: real photos, or three framings of one photo like the prototype.
  const slides = l.photos.length > 1 ? l.photos.map((p) => ({ p, zoom: undefined as string | undefined })) : [0, 1, 2].map((i) => ({ p: l.photos[0] ?? null, zoom: l.photos[0]?.fit === "contain" ? (i === 1 ? "scale(1.35)" : i === 2 ? "scale(1.15) translateY(8%)" : undefined) : undefined }));

  // The value card: price now, original price, bought, then the actions.
  const nowPrice =
    l.mode === "rent" ? (
      <>
        {fmt(l.price)}
        <small>/{unitWord(l.rentUnit)}</small>
      </>
    ) : l.price === 0 && l.mode === "sell" ? (
      "Free"
    ) : (
      fmt(l.price)
    );
  const nowSub =
    l.mode === "rent"
      ? l.mrp
        ? `${((l.price / l.mrp) * 100).toFixed(l.price / l.mrp < 0.01 ? 1 : 0)}% of its value per ${unitWord(l.rentUnit)}`
        : ""
      : l.mode === "auction"
        ? l.bidCount
          ? "current bid"
          : "starting bid"
        : offPct(l.price, l.mrp) != null
          ? `${offPct(l.price, l.mrp)}% below original`
          : "";

  const chatBtn = (
    <button
      key="chat"
      type="button"
      className="btn sec"
      onClick={() => openChat(s.id, l.id, undefined, { other: s, listing: { id: l.id, title: l.title, price: l.price, photoUrl: l.photo?.url } })}
      disabled={chatPending}
      aria-label={`Chat with ${first}`}
    >
      {chatPending ? <span className="spin" /> : <Icon name="chat" />}
      Chat with {first}
    </button>
  );
  let primary: React.ReactNode = null;
  let secondary: React.ReactNode[] = [];
  if (!available) {
    primary = mine && ["sold", "closed", "expired", "claimed"].includes(l.status) ? (
      l.mode === "auction" && l.status === "closed" ? (
        <button type="button" className="btn block" onClick={() => setSheet("close")}>
          <Icon name="hammer" />
          Choose a buyer
        </button>
      ) : (
        <button type="button" className="btn block" onClick={relist} disabled={pending || l.mode === "drop"}>
          <Icon name="repeat" />
          Relist a copy
        </button>
      )
    ) : (
      <button type="button" className="btn block" disabled>
        {l.status === "deleted" ? "This listing was deleted" : "No longer available"}
      </button>
    );
  } else if (mine) {
    primary = (
      <Link className="btn block" href={`/listings/${l.id}/edit`}>
        <Icon name="edit" />
        Edit listing
      </Link>
    );
    secondary = [
      <button key="p" type="button" className="btn sec" onClick={pause} disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name={l.status === "paused" ? "play" : "pause"} />}
        {l.status === "paused" ? "Resume" : "Pause"}
      </button>,
      <button key="d" type="button" className="btn sec danger-o" onClick={() => setSheet("del")}>
        <Icon name="trash" />
        Delete
      </button>,
      ...(l.mode === "auction"
        ? [
            <button key="c" type="button" className="btn sec" onClick={() => setSheet("close")}>
              <Icon name="hammer" />
              End auction
            </button>,
          ]
        : [
            <button key="s" type="button" className="btn sec" onClick={() => setSheet("sold")}>
              <Icon name="check" />
              Mark sold
            </button>,
          ]),
    ];
  } else if (l.mode === "rent" && l.rentUnit === "hour") {
    primary = (
      <button type="button" className="btn block" onClick={gate("Sign in to book hours", () => setSheet("hours"))}>
        <Icon name="clock" />
        Book hours · {fmt(l.price)}/hr
      </button>
    );
    secondary = [chatBtn];
  } else if (l.mode === "rent") {
    primary = (
      <button type="button" className="btn block" onClick={gate("Sign in to rent this", () => setSheet("dates"))}>
        <Icon name="cal" />
        Choose dates · {fmt(l.price)}/{unitShort(l.rentUnit)}
      </button>
    );
    secondary = [chatBtn];
  } else if (l.mode === "auction") {
    primary = (
      <button type="button" className="btn block" onClick={gate("Sign in to bid", () => setSheet("bid"))}>
        <Icon name="hammer" />
        Place bid · {fmt(nextBid(l.bidCount ? l.price : 0, l.reservePrice ?? l.price))}
      </button>
    );
    secondary = [
      ...(l.buyNowPrice
        ? [
            <button key="bn" type="button" className="btn sec" onClick={gate("Sign in to buy", () => setSheet("bid"))}>
              <Icon name="zap" />
              Buy now {fmt(l.buyNowPrice)}
            </button>,
          ]
        : []),
      chatBtn,
    ];
  } else if (l.mode === "drop") {
    primary = (
      <button type="button" className="btn block" onClick={claim} disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="zap" />}
        Claim it · {fmt(l.price)}
      </button>
    );
    secondary = [chatBtn];
  } else if (l.price === 0) {
    primary = (
      <button type="button" className="btn block" onClick={gate("Sign in to ask for it", () => setSheet("buy"))}>
        <Icon name="gift" />I want this
      </button>
    );
    secondary = [chatBtn];
  } else {
    primary = (
      <button type="button" className="btn block" onClick={gate("Sign in to buy", () => setSheet("buy"))}>
        <Icon name="bag" />
        Buy now · {fmt(l.price)}
      </button>
    );
    secondary = [
      <button key="o" type="button" className="btn sec" onClick={gate("Sign in to make an offer", () => setSheet("offer"))}>
        <Icon name="tag" />
        Make an offer
      </button>,
      chatBtn,
    ];
  }

  const facts: [string, string, string | null][] = [
    ["tag", "Brand", l.brand],
    ["layers", "Model", l.model],
    ["sparkles", "Condition", l.mode === "drop" ? null : l.condition],
    ...(hasAge(l) ? ([["cal", "Purchased", `${boughtLabel(l.purchasedOn)}${l.purchasedOn ? ` (${ageText(m)})` : ""}`]] as [string, string, string][]) : []),
    ...(l.sealStatus ? ([["shield", "Seal", l.sealStatus], ["hourglass", "Expiry", l.expiresOn ? new Date(l.expiresOn).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null]] as [string, string, string | null][]) : []),
    ...l.specs.filter((x) => !["Brand", "Model"].includes(x.k)).map((x) => ["ruler", x.k, x.v] as [string, string, string]),
    ["pin", "Pickup", effectivePickupHostel],
    ["wallet", "Payment", "UPI or cash at handover"],
    ["eye", "Listed", `${ago(l.createdAt)} · ${l.views} views`],
  ];
  const facts2 = facts.filter((f) => f[2]);
  const bundleSum = l.bundleItems.reduce((a, x) => a + x.price, 0);
  const qs = ["Is this still available?", l.mode === "rent" ? (l.rentUnit === "hour" ? "Is it free tonight?" : "Free this weekend?") : `Can you do ${fmt(Math.round((l.price * 0.85) / 10) * 10)}?`, "When can I pick it up?", "Any defects?"];

  return (
    <>
      <main className="flush withbar itempage" style={{ paddingLeft: 14, paddingRight: 14 }}>
        <div className="itemcols">
          <div className="itemleft">
            <div className="gal">
              <div
                className="gtrack"
                ref={trackRef}
                onScroll={(e) => {
                  const w = e.currentTarget.clientWidth || 1;
                  const next = Math.round(e.currentTarget.scrollLeft / w);
                  if (next !== slide && next >= 0 && next < slides.length) {
                    setSlide(next);
                  }
                }}
                aria-label="Photos"
              >
                {slides.map(({ p, zoom }, i) => (
                  <div className="gslide" key={i}>
                    {p ? (
                      // eslint-disable-next-line @next/next/no-img-element -- gallery photo, object-fit handled in CSS
                      <img src={p.url} alt={i === 0 ? l.title : ""} className={p.fit === "cover" ? "cover" : ""} style={zoom ? { transform: zoom } : undefined} decoding="async" />
                    ) : (
                      <PhotoTile l={l} className="" style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }} />
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="fbtn" style={{ left: 12 }} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} aria-label="Back">
                <Icon name="back" />
              </button>
              <button type="button" className="fbtn" style={{ right: 116 }} onClick={share} aria-label="Share">
                <Icon name="share" />
              </button>
              <button type="button" className={`fbtn ${saved ? "on" : ""}`} style={{ right: 64 }} onClick={heart} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved}>
                <Icon name="heart" />
              </button>
              <ThemeToggle className="fbtn mthm" style={{ right: 12 }} />
              <div className="gtag">
                <ModeBadge l={l} />
              </div>
              {slides.length > 1 && (
                <div className="gdots" role="tablist" aria-label="Photos carousel navigation">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === slide}
                      aria-label={`Photo ${i + 1} of ${slides.length}`}
                      className={`gdot ${i === slide ? "on" : ""}`}
                      onClick={() => scrollToSlide(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="stack itemright" style={{ gap: 14, marginTop: 14 }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {l.brand && (
                <span className="badge b-neutral">
                  <Icon name="tag" />
                  {l.brand}
                </span>
              )}
              <span className="badge b-neutral">
                <Icon name={categoryIcon} />
                {categoryShort}
              </span>
              {near && (
                <span className="badge b-near">
                  <Icon name="pin" />
                  Your hostel
                </span>
              )}
              {l.mode === "drop" && (
                <span className="badge b-drop">
                  <Icon name="home" />
                  Hostel-only drop
                </span>
              )}
              {l.status === "paused" && <span className="st st-paused">Paused · hidden from search</span>}
              {l.status === "deleted" && <span className="st st-deleted">Deleted</span>}
            </div>
            <h1 className="ititle">{l.title}</h1>

            {l.mode === "drop" ? (
              <div className="panel pad stack vcard" style={{ gap: 12 }}>
                <div className="between">
                  <div>
                    <div className="price" style={{ fontSize: 24 }}>
                      {fmt(l.price)}
                    </div>
                    <span className="sm muted">
                      <Icon name="pin" className="icon i14" /> {effectivePickupHostel} · only people in {effectivePickupHostel} can see this
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="label" style={{ justifyContent: "flex-end" }}>
                      Gone in
                    </span>
                    {l.endsAt && <Countdown endsAt={l.endsAt} hotMin={10} className="price" />}
                  </div>
                </div>
                <div className="vc-buy">
                  {primary}
                  {secondary.length > 0 && <div className={`vc-sec ${secondary.length === 1 ? "one" : ""}`}>{secondary}</div>}
                </div>
              </div>
            ) : l.categoryId === "tickets" ? (
              <div className="panel pad stack vcard" style={{ gap: 12 }}>
                <div>
                  <div className="price" style={{ fontSize: 24 }}>
                    {fmt(l.price)}
                  </div>
                  {l.mrp ? <span className="sm muted">Face value {fmt(l.mrp)}</span> : null}
                  {l.mode === "auction" && l.endsAt && (
                    <div className="meta">
                      <Icon name="hourglass" /> Ends in <Countdown endsAt={l.endsAt} hotMin={60} />
                    </div>
                  )}
                </div>
                <div className="vc-buy">
                  {primary}
                  {secondary.length > 0 && <div className={`vc-sec ${secondary.length === 1 ? "one" : ""}`}>{secondary}</div>}
                </div>
              </div>
            ) : (
              <div className="panel pad stack vcard" style={{ gap: 12 }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div>
                    <span className="label">{l.mode === "rent" ? "Rent" : l.mode === "auction" ? "Bid now" : "Asking price"}</span>
                    <div className="price" style={{ fontSize: 26 }}>
                      {nowPrice}
                    </div>
                    <span className={`xs ${l.mode === "sell" ? "off" : "muted"}`} style={{ margin: 0 }}>
                      {nowSub}
                    </span>
                    {l.mode === "auction" && l.endsAt && (
                      <div className="sm muted row" style={{ gap: 4, marginTop: 4 }}>
                        <Icon name="hourglass" className="icon i14" />
                        <Countdown endsAt={l.endsAt} hotMin={60} /> left · {l.bidCount} bid{l.bidCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  {hasAge(l) && <AgeBadge l={l} big />}
                </div>
                <div className="row" style={{ gap: 0, borderTop: "1px dashed var(--line-2)", paddingTop: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <span className="label">
                      <Icon name="tag" />
                      Original price
                    </span>
                    <b style={{ fontSize: 15 }}>{l.mrp ? fmt(l.mrp) : "Not given"}</b>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="label">
                      <Icon name="cal" />
                      Bought
                    </span>
                    <b style={{ fontSize: 15 }}>{boughtLabel(l.purchasedOn)}</b>
                    <div className="xs faint">{m != null ? ageText(m, true) : ""}</div>
                  </div>
                </div>
                {typical && (
                  <div className="note" style={l.price <= (typical.lo + typical.hi) / 2 ? { color: "var(--good)" } : undefined}>
                    <Icon name="trend" />
                    <span>
                      {l.price <= (typical.lo + typical.hi) / 2 ? "Good price. " : ""}Similar items sold for {fmt(typical.lo)}
                      {typical.hi !== typical.lo ? ` to ${fmt(typical.hi)}` : ""}
                    </span>
                  </div>
                )}
                <div className="vc-buy">
                  {primary}
                  {secondary.length > 0 && <div className={`vc-sec ${secondary.length === 1 ? "one" : ""}`}>{secondary}</div>}
                  {!mine && (
                    <div className="bbnote">
                      <Icon name="shield" className="icon i14" />
                      Pay {first} at handover by UPI or cash. Nothing is charged online.
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link className="panel sellerc" href={`/u/${s.id}`}>
              <Avatar name={s.name} url={s.avatarUrl} color={s.avatarColor} size={46} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{s.name}</b>
                <br />
                <span className="xs">
                  <TrustLine plume={s.plume} ratedDeals={s.ratedDeals} />
                </span>
                <br />
                <span className="faint xs">
                  {s.responseNote ? `${s.responseNote} · ` : ""}
                  {effectivePickupHostel}
                </span>
              </span>
              <Icon name="chev" className="icon i18" />
            </Link>
            {!mine && (
              <div style={{ alignSelf: "flex-start", marginTop: -6 }}>
                <ReportButton listingId={l.id} label="Report this listing" />
              </div>
            )}
            {s.plume < 0 && (
              <div className="note" style={{ color: "var(--bad)" }}>
                <Icon name="info" />
                <span>This seller has mixed reviews. Read them first and take photos at handover.</span>
              </div>
            )}
            {!mine && available && (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  <Icon name="chat" />
                  Ask {first}
                </div>
                <div className="chiprow" style={{ paddingBottom: 2 }}>
                  {qs.map((q) => (
                    <button key={q} type="button" className="chip" onClick={() => openChat(s.id, l.id, q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {l.bundleItems.length > 0 && (
              <div className="panel pad stack" style={{ gap: 10 }}>
                <div className="between">
                  <h3>What&apos;s in this bundle</h3>
                  {bundleSum > l.price && <span className="badge b-sell">Save {fmt(bundleSum - l.price)}</span>}
                </div>
                {l.bundleItems.map((x) => (
                  <Link key={x.id} className="row plain" href={`/item/${x.id}`} style={{ textAlign: "left" }}>
                    <span style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flex: "none" }}>
                      <PhotoTile l={x} style={{ width: 48, height: 48 }} />
                    </span>
                    <span className="sm" style={{ flex: 1 }}>
                      {x.title}
                    </span>
                    <b className="sm">{fmt(x.price)}</b>
                  </Link>
                ))}
                <div className="between sm" style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 8 }}>
                  <span className="muted">
                    Separately <s>{fmt(bundleSum)}</s>
                  </span>
                  <b>Bundle {fmt(l.price)}</b>
                </div>
              </div>
            )}
            {l.bundleContents.length > 0 && (
              <div className="panel pad">
                <h3 style={{ marginBottom: 8 }}>What&apos;s in this bundle</h3>
                <ul className="bullets">
                  {l.bundleContents.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {l.partOfBundle && (
              <div className="panel pad stack" style={{ gap: 10 }}>
                <h3>Frequently bought together</h3>
                <div className="between">
                  <span className="sm">
                    Get it in <b>{l.partOfBundle.title}</b> for <b>{fmt(l.partOfBundle.price)}</b>
                  </span>
                  <Link className="btn small" href={`/item/${l.partOfBundle.id}`}>
                    See bundle
                  </Link>
                </div>
              </div>
            )}

            {mine && history.length > 0 && (
              <div className="panel pad">
                <h3 style={{ marginBottom: 6 }}>
                  <Icon name="clock" className="icon i16" /> Edit history
                </h3>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="xs muted" style={{ padding: "3px 0" }}>
                    {ago(h.at)}: {h.changes}
                  </div>
                ))}
              </div>
            )}

            <div className="panel pad">
              <h3 style={{ marginBottom: 4 }}>Details</h3>
              <div className="facts">
                {facts2.map(([i, k, v]) => (
                  <div className="fact" key={k + v}>
                    <Icon name={i} />
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            </div>
            <PickupSnippet
              pickupHostel={effectivePickupHostel}
              pickupLat={l.pickupLat}
              pickupLng={l.pickupLng}
              viewerHostel={viewer?.hostel}
              title={l.title}
            />
            <div className="panel pad">
              <h3 style={{ marginBottom: 8 }}>About this item</h3>
              <ul className="bullets">
                {(l.description || "No description yet")
                  .split("\n")
                  .filter(Boolean)
                  .map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
              </ul>
              {l.sealStatus && (
                <div className="note" style={{ marginTop: 10 }}>
                  <Icon name="info" />
                  <span>Check the seal and expiry at pickup.</span>
                </div>
              )}
            </div>
            <div className="panel pad">
              <div className="between" style={{ marginBottom: 4 }}>
                <h3>Reviews of {first}</h3>
                <span className="faint xs">{reviewCount}</span>
              </div>
              {reviews.length ? reviews.map((r) => <RevRow key={r.id} r={r} />) : <p className="faint sm">No reviews yet.</p>}
            </div>
          </div>
        </div>
        {similar.length > 0 && (
          <section className="sec">
            <div className="sh">
              <h2>
                <Icon name="layers" />
                Similar items
              </h2>
            </div>
            <div className="hrail">
              {similar.map((x) => (
                <ProductCard key={x.id} l={x} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Phone action bar (the desktop uses the panel above). */}
      <div className="actbar">
        {!available ? (
          <>
            <div className="pr">
              <b>No longer available</b>
              <span>This item was {l.status}</span>
            </div>
            <Link className="btn sec" href="/">
              Go home
            </Link>
          </>
        ) : mine ? (
          <>
            <button type="button" className="sqbtn" style={{ color: "var(--bad)" }} aria-label="Delete listing" onClick={() => setSheet("del")}>
              <Icon name="trash" />
            </button>
            <div className="pr">
              <b>{fmt(l.price)}</b>
              <span>{l.status === "paused" ? "Paused · hidden from search" : "Your listing"}</span>
            </div>
            <Link className="btn" href={`/listings/${l.id}/edit`}>
              <Icon name="edit" />
              Edit
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              className="sqbtn"
              onClick={() => openChat(s.id, l.id, undefined, { other: s, listing: { id: l.id, title: l.title, price: l.price, photoUrl: l.photo?.url } })}
              disabled={chatPending}
              aria-label="Chat with seller"
            >
              {chatPending ? <span className="spin" /> : <Icon name="chat" />}
            </button>
            {l.mode === "sell" && l.price > 0 ? (
              <>
                <button type="button" className="btn sec" style={{ padding: "0 16px" }} onClick={gate("Sign in to make an offer", () => setSheet("offer"))}>
                  <Icon name="tag" />
                  Offer
                </button>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={gate("Sign in to buy", () => setSheet("buy"))}>
                  Buy {fmt(l.price)}
                </button>
              </>
            ) : (
              <>
                <div className="pr">
                  <b>
                    {l.mode === "rent" ? `${fmt(l.price)}/${unitShort(l.rentUnit)}` : l.price === 0 ? "Free" : fmt(l.price)}
                  </b>
                  <span>
                    {l.mode === "rent" ? "Pay the rent at pickup" : l.mode === "auction" && l.endsAt ? <><Countdown endsAt={l.endsAt} /> left</> : l.mode === "drop" ? "First to claim gets it" : "Just pick it up"}
                  </span>
                </div>
                {primary}
              </>
            )}
          </>
        )}
      </div>

      {l.mode === "auction" && <BidSheet open={sheet === "bid"} onOpenChange={(o) => setSheet(o ? "bid" : null)} l={l} />}
      {l.mode === "sell" && <BuySheet open={sheet === "buy"} onOpenChange={(o) => setSheet(o ? "buy" : null)} l={l} />}
      {l.mode === "sell" && <OfferSheet open={sheet === "offer"} onOpenChange={(o) => setSheet(o ? "offer" : null)} l={l} />}
      {l.mode === "rent" && l.rentUnit !== "hour" && <DatesSheet open={sheet === "dates"} onOpenChange={(o) => setSheet(o ? "dates" : null)} l={l} bookings={l.bookings} />}
      {l.mode === "rent" && l.rentUnit === "hour" && <HoursSheet open={sheet === "hours"} onOpenChange={(o) => setSheet(o ? "hours" : null)} l={l} bookings={l.bookings} />}
      {mine && (
        <>
          <DeleteDialog open={sheet === "del"} onOpenChange={(o) => setSheet(o ? "del" : null)} listing={l} bids={l.bidCount} bookedAhead={upcomingBookings} afterDelete={() => router.push("/my-listings")} onEndAuction={() => setSheet("close")} />
          {l.mode === "auction" && <CloseAuctionSheet open={sheet === "close"} onOpenChange={(o) => setSheet(o ? "close" : null)} l={l} />}
          <SoldSheet open={sheet === "sold"} onOpenChange={(o) => setSheet(o ? "sold" : null)} l={l} chatters={chatters} />
        </>
      )}
    </>
  );
}
