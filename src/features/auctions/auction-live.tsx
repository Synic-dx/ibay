"use client";
/**
 * FEATURE: Live auction panel on the item page [RUBRIC:EXTRA]
 * WHAT: Where you stand ("You're the highest bidder" / "You've been outbid")
 *       and the complete bid history: who bid, how much and when, newest top
 *       bid first. Updates by itself when anyone bids (see useAuctionLive).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/brand";
import { browserClient } from "@/lib/supabase/browser";
import { ago, fmt } from "@/lib/format";

export type BidRow = { id: string; amount: number; createdAt: string; bidderId: string; bidderName: string };

const SHOW_FIRST = 5;

/**
 * Keeps an auction page live: refreshes when a bid lands (database change or
 * the server's "bid" broadcast), checks every 20 s as a backup, and pops a
 * short message when someone else bids or you are outbid.
 */
export function useAuctionLive({ listingId, enabled, active, bids, viewerId }: { listingId: string; enabled: boolean; active: boolean; bids: BidRow[]; viewerId?: string | null }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTop = useRef<BidRow | undefined>(bids[0]);

  // 1. Realtime: database change on bids/listing, or the server's broadcast after a bid.
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !enabled) return;
    // WHY: debounce so a burst of events causes one refresh.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    const ch = sb
      .channel(`listing-${listingId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `listing_id=eq.${listingId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${listingId}` }, refresh)
      .on("broadcast", { event: "bid" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      sb.removeChannel(ch);
    };
  }, [listingId, enabled, router]);

  // 2. Backup: check every 20 s while the auction is running and the tab is visible.
  useEffect(() => {
    if (!enabled || !active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(t);
  }, [enabled, active, router]);

  // 3. Tell the viewer what changed.
  useEffect(() => {
    const top = bids[0];
    const prev = lastTop.current;
    lastTop.current = top;
    if (!enabled || !top || top.id === prev?.id || !prev) return;
    if (top.bidderId === viewerId) return; // their own bid already showed "Bid placed"
    if (prev.bidderId === viewerId) toast.error(`You've been outbid: ${fmt(top.amount)} by ${top.bidderName}`);
    else toast(`New bid: ${fmt(top.amount)} by ${top.bidderName}`);
  }, [enabled, bids, viewerId]);
}

export function AuctionLive({ bids, viewerId, sellerId, onBid }: { bids: BidRow[]; viewerId?: string | null; sellerId: string; onBid?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const top = bids[0];
  const mine = viewerId === sellerId;
  const myBest = viewerId ? bids.find((b) => b.bidderId === viewerId) : undefined;
  const leading = !!top && top.bidderId === viewerId;
  const outbid = !!myBest && !leading;
  const bidders = new Set(bids.map((b) => b.bidderId)).size;
  const shown = showAll ? bids : bids.slice(0, SHOW_FIRST);

  return (
    <section className="panel pad stack auclive" aria-label="Bids" aria-live="polite" style={{ gap: 12 }}>
      {leading && (
        <div className="aucstat lead" role="status">
          <Icon name="trophy" />
          <span>
            <b>You&apos;re the highest bidder</b> at {fmt(top.amount)}. We&apos;ll tell you if someone outbids you.
          </span>
        </div>
      )}
      {outbid && (
        <div className="aucstat out" role="status">
          <Icon name="alert" />
          <span>
            <b>You&apos;ve been outbid.</b> Top bid is {fmt(top.amount)} by {top.bidderName}. Your best was {fmt(myBest.amount)}.
          </span>
          {onBid && (
            <button type="button" className="btn small" onClick={onBid}>
              Bid again
            </button>
          )}
        </div>
      )}
      {mine && top && (
        <div className="aucstat seller" role="status">
          <Icon name="users" />
          <span>
            {bidders} {bidders === 1 ? "person is" : "people are"} bidding. Top bid {fmt(top.amount)} by {top.bidderName}.
          </span>
        </div>
      )}

      <div className="between">
        <span className="label">
          <Icon name="hammer" />
          Bids ({bids.length})
        </span>
        <span className="xs faint">Updates live</span>
      </div>

      {bids.length ? (
        <ol className="bidlist">
          {shown.map((b, i) => {
            const you = b.bidderId === viewerId;
            return (
              <li key={b.id} className={`${i === 0 ? "top" : ""} ${you ? "you" : ""}`}>
                <Avatar name={b.bidderName} size={30} />
                <span className="who">
                  <b>{you ? `You (${b.bidderName})` : b.bidderName}</b>
                  <span className="xs faint">{ago(b.createdAt)}</span>
                </span>
                {i === 0 && <span className="badge b-auction">Top bid</span>}
                <b className="amt">{fmt(b.amount)}</b>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="sm faint">No bids yet. Be the first.</p>
      )}
      {bids.length > SHOW_FIRST && (
        <button type="button" className="btn quiet small" style={{ alignSelf: "flex-start" }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${bids.length} bids`}
          <Icon name={showAll ? "up" : "down"} />
        </button>
      )}
    </section>
  );
}
