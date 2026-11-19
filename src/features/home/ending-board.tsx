"use client";
/**
 * FEATURE: "Ending soon" board on the home page [RUBRIC:EXTRA]
 * WHAT: Two columns: food drops in your hostel (Claim in one tap) and live
 *       auctions (Bid ₹next in one tap). Timers turn amber then red.
 *       Guests see a locked food-drop panel (drops are hostel-only).
 */
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Countdown } from "@/components/countdown";
import { useApp } from "@/components/app-context";
import { fmt, nextBid } from "@/lib/format";
import { PhotoTile } from "@/features/listings/components/parts";
import { claimDrop } from "@/features/drops/actions";
import type { ListingCard } from "@/features/listings/types";

export function EndingBoard({ drops, auctions, allDrops }: { drops: ListingCard[]; auctions: ListingCard[]; allDrops: number }) {
  const { viewer, openAuth } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!allDrops && !auctions.length) return null;

  const claim = (l: ListingCard) => {
    if (!viewer) return openAuth({ reason: "Sign in to claim this food drop before it is gone", next: "/browse?cat=food" });
    start(async () => {
      const r = await claimDrop(l.id);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      router.push(r.data.conversationId ? `/messages/${r.data.conversationId}` : "/deals");
    });
  };

  const row = (l: ListingCard, k: "d" | "a") => (
    <div className="erow" key={l.id}>
      <Link className="er-ph" href={`/item/${l.id}`} aria-hidden="true" tabIndex={-1}>
        <PhotoTile l={l} />
      </Link>
      <Link className="er-t" href={`/item/${l.id}`}>
        <b>{l.title}</b>
        <span className="xs muted">
          {k === "d" ? (
            <>
              {fmt(l.price)} · {l.pickupHostel}
              {viewer?.hostel === l.pickupHostel && (
                <>
                  {" "}
                  · <span className="near">your hostel</span>
                </>
              )}
            </>
          ) : (
            <>
              {l.bidCount ? "Top bid" : "Starts at"} <b className="tx-ink">{fmt(l.price)}</b> · {l.bidCount} bid{l.bidCount === 1 ? "" : "s"}
              {l.mrp ? ` · worth ${fmt(l.mrp)} new` : ""}
            </>
          )}
        </span>
      </Link>
      <span className="er-tm">
        <Icon name={k === "d" ? "flame" : "hourglass"} className="icon i14" />
        <Countdown endsAt={l.endsAt!} hotMin={k === "d" ? 10 : 60} />
      </span>
      {k === "d" ? (
        <button type="button" className="btn small er-b" onClick={() => claim(l)} disabled={pending} aria-label={`Claim food drop: ${l.title}`}>
          {pending ? <span className="spin" /> : <Icon name="zap" />}
          Claim
        </button>
      ) : (
        <Link
          className="btn small er-b"
          href={`/item/${l.id}?sheet=bid`}
          aria-label={`Bid on auction: ${l.title}`}
          onClick={(e) => {
            if (!viewer) {
              e.preventDefault();
              openAuth({ reason: "Sign in to bid", next: `/item/${l.id}?sheet=bid` });
            }
          }}
        >
          <Icon name="hammer" />
          Bid {fmt(nextBid(l.bidCount ? l.price : 0, l.reservePrice ?? l.price))}
        </Link>
      )}
    </div>
  );

  const col = (icon: string, title: string, sub: string, items: ListingCard[], k: "d" | "a", more: string) => (
    <div className="panel eb-col">
      <div className="between eb-h">
        <span>
          <b>
            <Icon name={icon} />
            {title}
          </b>
          <span className="xs muted">{sub}</span>
        </span>
        <Link href={more}>
          See all
          <Icon name="chev" className="icon i14" />
        </Link>
      </div>
      {items.length ? items.slice(0, 4).map((l) => row(l, k)) : <p className="faint sm" style={{ padding: "10px 4px" }}>Nothing live right now.</p>}
    </div>
  );

  return (
    <section className="sec ending" aria-labelledby="ending-h">
      <div className="sh">
        <h2 id="ending-h">
          <span className="pulse" style={{ position: "static", marginRight: 2 }} />
          Ending soon
        </h2>
        <span className="xs muted">Timers are live. First come, first served.</span>
      </div>
      <div className="eb">
        {viewer ? (
          col(
            "flame",
            `Food drops in ${viewer.hostel}`,
            `${drops.length} live · only people in ${viewer.hostel} can see these${allDrops > drops.length ? ` · ${allDrops - drops.length} more in other hostels` : ""}`,
            drops,
            "d",
            "/browse?cat=food",
          )
        ) : (
          <div className="panel eb-col eb-lock">
            <div className="eb-h">
              <span>
                <b>
                  <Icon name="flame" />
                  Food drops
                </b>
                <span className="xs muted">Hostel-only. {allDrops} live across campus right now</span>
              </span>
            </div>
            <div className="lockbox">
              <span className="lk-ic">
                <Icon name="lock" className="icon i24" />
              </span>
              <b>Food drops stay inside your hostel</b>
              <span className="sm muted">Sign in and set your hostel to see extra food being shared by people on your floor. Pickup is a short walk, so it is still warm.</span>
              <button type="button" className="btn small" onClick={() => openAuth({ reason: "Sign in to see food drops in your hostel", next: "/browse?cat=food" })}>
                <Icon name="user" />
                Sign in to see your hostel&apos;s drops
              </button>
            </div>
          </div>
        )}
        {col("hammer", "Live auctions", `${auctions.length} running · highest bid wins`, auctions, "a", "/browse?modes=auction")}
      </div>
    </section>
  );
}
