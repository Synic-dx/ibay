"use client";
/**
 * FEATURE: People are looking for (Request Rail)
 * WHAT: Responsive horizontal rail showing campus requests with left/right
 *       arrow navigation buttons on desktop and touch scrolling on mobile.
 * SIZING: Shows 2-3 cards comfortably at once on desktop, 2 on tablet, and 1 on phone.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { dayLabel, dayOffsetOf } from "@/lib/format";
import { RequestLink } from "@/features/requests/request-link";
import type { RequestItem } from "@/features/requests/queries";

export function RequestRail({ requests }: { requests: RequestItem[] }) {
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
  }, [updateScrollButtons, requests]);

  const scroll = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, Math.floor(el.clientWidth * 0.75));
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

  if (!requests.length) return null;

  return (
    <section className="sec">
      <div className="sh">
        <h2>
          <Icon name="list" />
          People are looking for
        </h2>
        <div className="sh-actions">
          <RequestLink href="/requests">
            All
            <Icon name="chev" />
          </RequestLink>
          <div className="rail-nav">
            <button
              type="button"
              className="rnav-btn"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Previous requests"
              title="Previous requests"
            >
              <Icon name="chevLeft" />
            </button>
            <button
              type="button"
              className="rnav-btn"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Next requests"
              title="Next requests"
            >
              <Icon name="chev" />
            </button>
          </div>
        </div>
      </div>
      <div
        className="hrail reqrail"
        ref={railRef}
        onScroll={updateScrollButtons}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="People are looking for"
      >
        {requests.map((r) => {
          const off = r.neededBy ? dayOffsetOf(r.neededBy) : null;
          return (
            <RequestLink
              key={r.id}
              href={`/requests/${r.id}`}
              className="panel pad stack req-card"
            >
              <div className="row xs faint" style={{ gap: 6, alignItems: "center" }}>
                <Avatar name={r.author.name} url={r.author.avatarUrl} color={r.author.avatarColor} size={20} />
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                  {r.author.name.split(" ")[0]} · {r.author.hostel}
                </span>
              </div>
              <b className="req-title">&ldquo;{r.text}&rdquo;</b>
              <div className="row req-meta" style={{ gap: 6, flexWrap: "wrap", marginTop: "auto", paddingTop: 8 }}>
                {off != null && (
                  <span className={`badge ${off <= 2 ? "b-drop" : "b-neutral"}`}>
                    <Icon name="cal" className="icon i12" />
                    By {dayLabel(off, true)}
                  </span>
                )}
                {r.budget && <span className="faint xs" style={{ alignSelf: "center" }}>{r.budget}</span>}
              </div>
              <div style={{ marginTop: 4 }}>
                <span className="sm req-cta" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                  I have this ›
                </span>
              </div>
            </RequestLink>
          );
        })}
      </div>
    </section>
  );
}
