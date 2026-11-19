"use client";
/**
 * FEATURE: Home hero carousel + side cards
 * WHAT: 7 slides (Preprocess, Big brands, Garba & Diwali, Live auctions, Food
 *       drops, Placement formals, Gym Corner). Auto-advances every 6 s and
 *       pauses on hover or while any dialog is open. On desktop two side cards:
 *       "Moving out?" with the most-wanted request, and "Can't find it?" which
 *       becomes "Rate N finished deals" when ratings are pending.
 */
import Link from "@/components/ui/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useApp } from "@/components/app-context";

type Slide = { eb: [string, string]; t: string; p: string; href: string; cta: string; pics: string[]; cover?: boolean; gated?: string };

const HEROES: Slide[] = [
  { eb: ["drama", "Preprocess season"], t: "Seniors set a wild dress code? Rent it by the hour.", p: "Wigs, neon suits, loud shirts, sarees. Book only the hours you need.", href: "/browse?cat=preprocess", cta: "Preprocess Store", pics: ["/img/kurta-pink.webp", "/img/blouse-green.webp"], cover: true },
  { eb: ["tag", "Big brands, small prices"], t: "Ray-Ban, Yonex, Nike, Apple. Up to 70% off.", p: "Every listing shows the original price and how old it is.", href: "/browse?sort=off", cta: "See the deals", pics: ["/img/af1.webp", "/img/smartwatch.webp"] },
  { eb: ["sparkles", "Garba Night & Diwali"], t: "Chaniya cholis, kurtas and dandiya, ready to rent.", p: "Plus fairy lights and diyas for your room.", href: "/browse?coll=garba", cta: "Shop festive", pics: ["/art/chaniya.svg", "/img/kurta-cream.webp"] },
  { eb: ["hammer", "Live auctions"], t: "Bid on jackets, racquets and kurtas. Highest bid wins.", p: "Every auction shows the top bid and a live timer.", href: "/browse?modes=auction", cta: "See live auctions", pics: ["/img/puffer.webp", "/img/racquet.webp"] },
  { eb: ["flame", "Food drops in your hostel"], t: "Extra cake or a sealed pack of chips? Grab it before it is gone.", p: "Drops are only shown to people in the same hostel, so pickup is a walk down the corridor.", href: "/browse?cat=food", cta: "See drops near you", pics: ["/img/cake.webp", "/img/chips.webp"], gated: "Sign in to see food drops in your hostel" },
  { eb: ["shirt", "Placement season"], t: "Blazers and formal shoes for your interviews, rented or bought.", p: "Size and fit listed on every item.", href: "/browse?cat=formals", cta: "Shop formals", pics: ["/img/blazer.webp", "/img/oxfords.webp"] },
  { eb: ["dumbbell", "Gym Corner"], t: "Whey, creatine and belts from people who train here.", p: "Sealed or opened, expiry always shown.", href: "/browse?cat=gym", cta: "Open Gym Corner", pics: ["/img/gloves.webp", "/img/duffel.webp"] },
];

export function HeroCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const { viewer, openAuth } = useApp();

  useEffect(() => {
    const t = setInterval(() => {
      const c = ref.current;
      // WHY: never move while someone is reading a dialog or hovering the slide.
      if (!c || c.matches(":hover") || document.querySelector('[role="dialog"]')) return;
      const i = (Math.round(c.scrollLeft / c.clientWidth) + 1) % HEROES.length;
      c.scrollTo({ left: i * c.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="heromain">
      <div className="carousel" ref={ref} onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} aria-roledescription="carousel" aria-label="Highlights">
        {HEROES.map((h, i) => (
          <Link
            key={h.cta}
            className="slide"
            href={h.href}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${HEROES.length}: ${h.t}`}
            onClick={(e) => {
              if (h.gated && !viewer) {
                e.preventDefault();
                openAuth({ reason: h.gated, next: h.href });
              }
            }}
          >
            <div className="t">
              <span className="eb">
                <Icon name={h.eb[0]} />
                {h.eb[1]}
              </span>
              <h3>{h.t}</h3>
              <p>{h.p}</p>
              <span className="btn mint small" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                {h.cta}
                <Icon name="arrow" />
              </span>
            </div>
            <div className="pics">
              {h.pics.map((p) => (
                <div key={p}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- decorative local images */}
                  <img src={p} alt="" className={h.cover ? "" : "fit"} />
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
      <div className="cdots" aria-hidden="true">
        {HEROES.map((h, i) => (
          <i key={h.cta} className={i === idx ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function HeroSide({ topRequest, openRequests, pendingRatings }: { topRequest: { text: string; votes: number } | null; openRequests: number; pendingRatings: number }) {
  const { viewer, openAuth } = useApp();
  const gate = (reason: string, href: string) => (e: React.MouseEvent) => {
    if (!viewer) {
      e.preventDefault();
      openAuth({ reason, next: href });
    }
  };
  return (
    <div className="heroside">
      <Link className="panel hcard" href="/sell" onClick={gate("Sign in to list something on i-bay", "/sell")}>
        <span className="hc-t">
          <span className="badge b-sell">
            <Icon name="tag" />
            Moving out?
          </span>
          <b>Sell or rent it out in a minute</b>
          <span className="sm muted">{topRequest ? `Wanted right now: "${topRequest.text}" (${topRequest.votes} people)` : "People in your hostel are looking."}</span>
          <span className="hc-go">
            List an item
            <Icon name="arrow" className="icon i16" />
          </span>
        </span>
        <span className="hc-pic hc-ic">
          <Icon name="plus" className="icon i28" />
        </span>
      </Link>
      {pendingRatings > 0 ? (
        <Link className="panel hcard" href="/deals">
          <span className="hc-t">
            <span className="badge b-near">
              <Icon name="star" />
              Your turn
            </span>
            <b>
              Rate {pendingRatings} finished deal{pendingRatings > 1 ? "s" : ""}
            </b>
            <span className="sm muted">Ratings build your Plume score and help others trust you.</span>
            <span className="hc-go">
              Rate now
              <Icon name="arrow" className="icon i16" />
            </span>
          </span>
          <span className="hc-pic hc-ic">
            <Icon name="star" className="icon i28" />
          </span>
        </Link>
      ) : (
        <Link className="panel hcard" href="/requests?new=1" onClick={gate("Sign in to post a request", "/requests?new=1")}>
          <span className="hc-t">
            <span className="badge b-neutral">
              <Icon name="help" />
              Can&apos;t find it?
            </span>
            <b>Post &quot;I am looking for a...&quot;</b>
            <span className="sm muted">{openRequests} open requests. People reply with photos and prices.</span>
            <span className="hc-go">
              Post a request
              <Icon name="arrow" className="icon i16" />
            </span>
          </span>
          <span className="hc-pic hc-ic">
            <Icon name="list" className="icon i28" />
          </span>
        </Link>
      )}
    </div>
  );
}
