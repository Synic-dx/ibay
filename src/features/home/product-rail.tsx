"use client";
/**
 * FEATURE: Product rail
 * WHAT: Single horizontal row of product cards with "See all" link and
 *       previous/next navigation arrow buttons for desktop and touch.
 */
import Link from "@/components/ui/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui/icon";
import { ProductCard } from "@/features/listings/components/product-card";
import type { ListingCard } from "@/features/listings/types";

type Props = {
  icon: string;
  title: string;
  sub?: string;
  items: ListingCard[];
  more: string;
};

export function ProductRail({ icon, title, sub, items, more }: Props) {
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
  }, [updateScrollButtons, items]);

  const scroll = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const scrollAmount = Math.max(220, Math.floor(el.clientWidth * 0.75));
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

  if (!items.length) return null;

  return (
    <section className="sec">
      <div className="sh">
        <h2>
          <Icon name={icon} />
          {title}
        </h2>
        <div className="sh-actions">
          <Link href={more}>
            See all
            <Icon name="chev" />
          </Link>
          <div className="rail-nav">
            <button
              type="button"
              className="rnav-btn"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label={`Previous ${title} items`}
              title="Previous items"
            >
              <Icon name="chevLeft" />
            </button>
            <button
              type="button"
              className="rnav-btn"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label={`Next ${title} items`}
              title="Next items"
            >
              <Icon name="chev" />
            </button>
          </div>
        </div>
      </div>
      {sub && <div className="sub">{sub}</div>}
      <div
        className="hrail"
        ref={railRef}
        onScroll={updateScrollButtons}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label={title}
      >
        {items.map((l) => (
          <ProductCard key={l.id} l={l} />
        ))}
      </div>
    </section>
  );
}
