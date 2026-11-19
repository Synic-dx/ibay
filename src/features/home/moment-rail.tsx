"use client";
/**
 * FEATURE: Shop by moment rail
 * WHAT: Single horizontal row of curated moment collections with left/right
 *       navigation arrow buttons, keyboard arrow key navigation, and smooth
 *       scrolling with zero clipping.
 */
import Link from "@/components/ui/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui/icon";

export type MomentCardData = {
  id: string;
  name: string;
  count: number;
  previews: { id: string; url?: string; cover?: boolean }[];
};

export function MomentRail({ moments }: { moments: MomentCardData[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollButtons, moments]);

  const scroll = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: dir === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll("right");
    }
  };

  if (!moments.length) return null;

  return (
    <section className="sec moment-section">
      <div className="sh">
        <h2>
          <Icon name="sparkles" />
          Shop by moment
        </h2>
        <div className="rail-nav">
          <button
            type="button"
            className="rnav-btn"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Previous moments"
            title="Previous moments"
          >
            <Icon name="chevLeft" />
          </button>
          <button
            type="button"
            className="rnav-btn"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Next moments"
            title="Next moments"
          >
            <Icon name="chev" />
          </button>
        </div>
      </div>
      <div
        className="hrail moment-rail"
        ref={railRef}
        onScroll={updateScrollButtons}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="Shop by moment collections"
      >
        {/* eslint-disable @next/next/no-img-element -- small local thumbnails */}
        {moments.map((c) => (
          <Link key={c.id} className="panel moment" href={`/browse?coll=${c.id}`}>
            <div className="th3">
              {c.previews.map((p) => (
                <span key={p.id}>
                  {p.url ? (
                    <img src={p.url} alt="" className={p.cover ? "cover" : ""} />
                  ) : (
                    <Icon name="ticket" />
                  )}
                </span>
              ))}
            </div>
            <div className="moment-meta">
              <b className="sm moment-name">{c.name}</b>
              <div className="faint xs moment-count">{c.count} items</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
