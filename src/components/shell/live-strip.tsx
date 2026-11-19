"use client";
/**
 * FEATURE: LIVE ticker [RUBRIC:EXTRA]
 * WHAT: Food drops in your hostel and running auctions, soonest first, with
 *       live timers (red for drops under 10 min, amber for auctions under 1 h).
 */
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Countdown } from "@/components/countdown";
import { useApp } from "@/components/app-context";
import { fmt } from "@/lib/format";
import type { ListingCard } from "@/features/listings/types";

export function LiveStrip({ drops, auctions }: { drops: ListingCard[]; auctions: ListingCard[] }) {
  const { viewer, openAuth } = useApp();
  const items = [...drops.map((l) => ["d", l] as const), ...auctions.map((l) => ["a", l] as const)].sort(
    (x, y) => new Date(x[1].endsAt!).getTime() - new Date(y[1].endsAt!).getTime(),
  );
  if (!items.length) return null;
  return (
    <div className="lstrip" role="region" aria-label="Live now">
      <span className="lst-l">
        <span className="pulse" />
        LIVE
      </span>
      <div className="lst-r">
        {items.map(([k, l]) => (
          <Link
            key={l.id}
            href={`/item/${l.id}`}
            className={`lchip ${k === "d" ? "ld" : "la"}`}
            onClick={(e) => {
              if (!viewer) {
                e.preventDefault();
                openAuth({ reason: "Sign in to see full details, book and chat with the seller", next: `/item/${l.id}` });
              }
            }}
          >
            <span className="lc-ph">
              {l.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny local thumbnail
                <img src={l.photo.url} alt="" className={l.photo.fit === "cover" ? "cover" : ""} />
              ) : (
                <Icon
                  name={l.categoryId === "tickets" ? "ticket" : k === "d" ? "flame" : "hammer"}
                  className="icon i16"
                />
              )}
            </span>
            <span className="lc-t">
              <b>{l.title.split(/[,(]/)[0]}</b>
              <span>
                <Icon name={k === "d" ? "flame" : "hammer"} className="icon i12" />
                {fmt(l.price)} · <Countdown endsAt={l.endsAt!} hotMin={k === "d" ? 10 : 60} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
