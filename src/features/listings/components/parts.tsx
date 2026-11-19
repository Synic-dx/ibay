/**
 * FEATURE: Small listing building blocks (shared by cards, the item page, chat and Mayu)
 * WHAT: photo tile, deal-type badge, colour-coded age badge, price line and
 *       the "Trusted seller · 23 deals" line. Markup and classes come from the prototype.
 */
import { Icon } from "@/components/ui/icon";
import { Countdown } from "@/components/countdown";
import { ageMonths, ageText, ageTone, boughtLabel, fmt, offPct, unitShort } from "@/lib/format";
import { trustLevel } from "@/lib/plume";
import type { ListingCard } from "../types";

/** Items where age does not apply (food and tickets). */
export const hasAge = (l: Pick<ListingCard, "categoryId" | "mode"> | null | undefined) => Boolean(l && !["food", "tickets"].includes(l.categoryId) && l.mode !== "drop");

/** The light photo tile: real photo, drawn artwork, a ticket graphic, or an icon. */
export function PhotoTile({
  l,
  className = "ph",
  style,
  children,
  zoom,
}: {
  l?: Partial<Pick<ListingCard, "photo" | "ticketInfo" | "title" | "categoryId">> | null;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  zoom?: string;
}) {
  let inner: React.ReactNode;
  const photo = l?.photo;
  const photoUrl = typeof photo === "string" ? photo : (photo as { url?: string } | null)?.url;
  const photoFit = typeof photo === "object" && (photo as { fit?: string } | null)?.fit === "cover" ? "cover" : "";
  const title = l?.title ?? "Item";
  const categoryId = l?.categoryId;
  const ticketInfo = l?.ticketInfo;

  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- local art and user photos of unknown size, shown with object-fit
    inner = <img src={photoUrl} alt={title} className={photoFit} loading="lazy" decoding="async" style={zoom ? { transform: zoom } : undefined} />;
  } else if (categoryId === "tickets" && Array.isArray(ticketInfo) && ticketInfo.length) {
    inner = (
      <div className="ticket" role="img" aria-label={title}>
        <div className="tm">
          <span>I-BAY RESALE</span>
          <b>{ticketInfo[0]}</b>
          <span>{ticketInfo[1]}</span>
        </div>
        <div className="ts">{ticketInfo[2]}</div>
      </div>
    );
  } else {
    inner = <Icon name={categoryId === "tickets" ? "ticket" : "img"} className="icon i40" label={title} />;
  }
  return (
    <div className={className} style={style}>
      {inner}
      {children}
    </div>
  );
}

/** Deal type badge: Bundle, Hourly, Rent, Auction, Food drop or Free. */
export function ModeBadge({ l }: { l: Pick<ListingCard, "mode" | "rentUnit" | "price" | "isBundle" | "bundleCount"> }) {
  if (l.isBundle)
    return (
      <span className="badge b-sell">
        <Icon name="layers" />
        Bundle · {l.bundleCount}
      </span>
    );
  if (l.mode === "rent")
    return (
      <span className="badge b-rent">
        <Icon name={l.rentUnit === "hour" ? "clock" : "repeat"} />
        {l.rentUnit === "hour" ? "Hourly" : "Rent"}
      </span>
    );
  if (l.mode === "auction")
    return (
      <span className="badge b-auction">
        <Icon name="hammer" />
        Auction
      </span>
    );
  if (l.mode === "drop")
    return (
      <span className="badge b-drop">
        <Icon name="flame" />
        Food drop
      </span>
    );
  if (l.price === 0)
    return (
      <span className="badge b-sell">
        <Icon name="gift" />
        Free
      </span>
    );
  return null;
}

/** Age badge: green under 6 months, teal 6 to 18, amber 18 to 36, red 3+ years. */
export function AgeBadge({ l, big = false }: { l: Pick<ListingCard, "categoryId" | "mode" | "purchasedOn">; big?: boolean }) {
  if (!hasAge(l)) return null;
  const m = ageMonths(l.purchasedOn);
  return (
    <span className={`age ${ageTone(m)} ${big ? "big" : ""}`} title={`Bought ${boughtLabel(l.purchasedOn)}`}>
      {ageText(m, big)}
    </span>
  );
}

/** Price line on cards (asking price + struck original + % off, or rent / bid / drop variants). */
export function PriceLine({ l }: { l: ListingCard }) {
  if (l.mode === "auction")
    return (
      <>
        <div className="price">{fmt(l.price)}</div>
        <div className="meta">
          <Icon name="hammer" />
          {l.bidCount} bid{l.bidCount === 1 ? "" : "s"} · {l.endsAt && <Countdown endsAt={l.endsAt} />}
        </div>
        {l.mrp ? <div className="meta">Worth {fmt(l.mrp)} new</div> : null}
      </>
    );
  if (l.mode === "rent" && l.rentUnit === "hour")
    return (
      <>
        <div className="price">
          {fmt(l.price)}
          <small>/hr</small>
        </div>
        <div className="meta">
          <Icon name="clock" />
          Free {l.nextFree ?? "soon"}
        </div>
        {l.mrp ? <div className="meta">Worth {fmt(l.mrp)} new</div> : null}
      </>
    );
  if (l.mode === "rent")
    return (
      <>
        <div className="price">
          {fmt(l.price)}
          <small>/{unitShort(l.rentUnit)}</small>
        </div>
        {l.mrp ? <div className="meta">Worth {fmt(l.mrp)} new</div> : null}
      </>
    );
  if (l.mode === "drop")
    return (
      <>
        <div className="price">{fmt(l.price)}</div>
        <div className="meta" style={{ color: "var(--bad)" }}>
          <Icon name="flame" />
          Gone in {l.endsAt && <Countdown endsAt={l.endsAt} />}
        </div>
      </>
    );
  if (l.price === 0)
    return (
      <>
        <div className="price" style={{ color: "var(--good)" }}>
          Free
        </div>
        {l.mrp ? <div className="meta">Worth {fmt(l.mrp)} new</div> : null}
      </>
    );
  const off = offPct(l.price, l.mrp);
  return (
    <div className="price">
      {fmt(l.price)}
      {l.mrp ? (
        <>
          <span className="mrp">{fmt(l.mrp)}</span>
          {off != null && off > 0 && <span className="off">{off}% off</span>}
        </>
      ) : null}
    </div>
  );
}

/** "Price dropped ₹200" for 7 days after a drop. */
export function PriceDrop({ l, short = false }: { l: Pick<ListingCard, "priceDropAmount" | "priceDroppedAt">; short?: boolean }) {
  if (!l.priceDropAmount || !l.priceDroppedAt) return null;
  if (Date.now() - new Date(l.priceDroppedAt).getTime() > 7 * 864e5) return null;
  return (
    <div className="pdrop">
      <Icon name="trend" className="icon i12" />
      {short ? "dropped" : "Price dropped"} {fmt(l.priceDropAmount)}
    </div>
  );
}

/** "★ Well rated · 23 deals" in words first, numbers second. */
export function TrustLine({ plume, ratedDeals, deals = true }: { plume: number; ratedDeals: number; deals?: boolean }) {
  const t = trustLevel(plume, ratedDeals);
  return (
    <>
      <span className={`trust ${t.tone}`} title={`Plume ${Math.round(plume)}`}>
        {t.tone === "t-good" && <Icon name="star" filled strokeWidth={0} className="icon" />}
        {t.label}
      </span>
      {deals && <span className="faint xs"> · {ratedDeals} deals</span>}
    </>
  );
}

/** Price as plain text, e.g. "₹150/day" (used in lists and chat). */
export const priceText = (l: Pick<ListingCard, "price" | "mode" | "rentUnit"> | null | undefined) => {
  if (!l || l.price == null) return "";
  return fmt(l.price) + (l.mode === "rent" && l.rentUnit ? "/" + unitShort(l.rentUnit) : "");
};
