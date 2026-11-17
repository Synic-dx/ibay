"use client";
/**
 * FEATURE: Item page sheets
 * BidSheet     one-tap bids, a custom amount, Buy it now and the bid history
 * BuySheet     "Buy now" with pickup time chips (nothing is charged)
 * OfferSheet   "Make an offer" (sends a structured offer into the chat)
 * CloseAuction seller picks any bidder, or ends without selling
 * SoldSheet    seller marks it sold and picks the buyer (other chats get a "sold" note)
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { ago, bidIncrement, fmt, left, nextBid } from "@/lib/format";
import { placeBid, buyNow } from "@/features/auctions/actions";
import { requestBuy } from "@/features/deals/actions";
import { openChat, sendOffer } from "@/features/chat/actions";
import { closeAuction, markSold } from "@/features/listings/actions/update";
import { PhotoTile } from "@/features/listings/components/parts";
import type { ListingCard, ListingDetail } from "@/features/listings/types";

type Base = { open: boolean; onOpenChange: (v: boolean) => void };

/** Opens a chat after an action (dock on desktop, page on phones). */
function useGoChat() {
  const router = useRouter();
  return (id: string | null) => {
    if (!id) return router.push("/deals");
    if (window.innerWidth >= 1080) window.dispatchEvent(new CustomEvent("ibay:open-chat", { detail: { id } }));
    else router.push(`/messages/${id}`);
  };
}

export function BidSheet({ open, onOpenChange, l }: Base & { l: ListingDetail }) {
  const { viewer } = useApp();
  const router = useRouter();
  const goChat = useGoChat();
  const [amt, setAmt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const top = l.bids[0];
  const current = top ? top.amount : 0;
  const nb = nextBid(current, l.reservePrice ?? l.price);
  const inc = bidIncrement(current || (l.reservePrice ?? l.price));
  const lead = top && top.bidderId === viewer?.id;

  const bid = (v: number) =>
    start(async () => {
      setErr(null);
      const r = await placeBid(l.id, v);
      if (!r.ok) {
        setErr(r.fieldErrors?.amount ?? r.formError ?? "Bid failed.");
        return;
      }
      toast(r.message);
      setAmt("");
      onOpenChange(false);
      router.refresh();
    });
  const buy = () =>
    start(async () => {
      const r = await buyNow(l.id);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      onOpenChange(false);
      router.refresh();
      goChat(r.data.conversationId);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="hammer" title="Place a bid" subtitle={`Ends in ${l.endsAt ? left(l.endsAt) : "-"} · ${l.bids.length} bids`}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="calc">
          <div>
            <span>{current ? "Current bid" : "Starting bid"}</span>
            <b>{fmt(current || (l.reservePrice ?? l.price))}</b>
          </div>
          <div>
            <span>Reserve</span>
            <span>{current >= (l.reservePrice ?? 0) && current ? "Met" : fmt(l.reservePrice ?? l.price)}</span>
          </div>
          {l.mrp ? (
            <div>
              <span>Original price</span>
              <span>{fmt(l.mrp)}</span>
            </div>
          ) : null}
        </div>
        {lead && (
          <span className="badge b-near" style={{ alignSelf: "flex-start", fontSize: 11, padding: "5px 10px" }}>
            <Icon name="trophy" />
            You are the highest bidder
          </span>
        )}
        <span className="label">One-tap bid</span>
        <div className="bidg">
          {[nb, nb + inc, nb + inc * 3].map((v) => (
            <button key={v} type="button" className="btn sec" style={{ padding: 0 }} onClick={() => bid(v)} disabled={pending}>
              {fmt(v)}
            </button>
          ))}
        </div>
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(amt.replace(/\D/g, ""));
            if (!v || v < nb) return setErr(`Bid at least ${fmt(nb)}.`);
            bid(v);
          }}
        >
          <div className="row">
            <input
              className={`input ${err ? "bad" : ""}`}
              inputMode="numeric"
              placeholder={`${fmt(nb)} or more`}
              aria-label="Custom bid"
              aria-invalid={!!err}
              aria-describedby={err ? "bid-err" : undefined}
              value={amt}
              onChange={(e) => (setAmt(e.target.value), setErr(null))}
            />
            <button className="btn" type="submit" disabled={pending}>
              Bid
            </button>
          </div>
          {err && (
            <span className="ferr" role="alert" id="bid-err">
              <Icon name="alert" className="icon i14" />
              {err}
            </span>
          )}
        </form>
        {l.buyNowPrice ? (
          <button type="button" className="btn mint block" onClick={buy} disabled={pending}>
            <Icon name="zap" />
            Buy it now for {fmt(l.buyNowPrice)}
          </button>
        ) : null}
        <div>
          <span className="label">Bid history</span>
          <div className="hist">
            {l.bids.slice(0, 5).map((b, i) => (
              <div key={b.id}>
                <span>
                  {b.bidderId === viewer?.id ? "You" : `${b.bidderName.split(" ")[0]} ${b.bidderName.split(" ")[1]?.[0] ?? ""}.`}
                  {i === 0 && <span className="badge b-auction" style={{ marginLeft: 6 }}>Top</span>}
                </span>
                <span>
                  <b>{fmt(b.amount)}</b> <span className="faint xs">{ago(b.createdAt)}</span>
                </span>
              </div>
            ))}
            {!l.bids.length && <div className="faint">No bids yet</div>}
          </div>
        </div>
        <div className="note">
          <Icon name="info" />
          <span>A bid in the last 2 minutes adds 2 more minutes, so nobody wins by sniping.</span>
        </div>
      </div>
    </Sheet>
  );
}

const WHEN = ["Today, evening", "Tomorrow, morning", "Tomorrow, evening", "Ask in chat"];

export function BuySheet({ open, onOpenChange, l }: Base & { l: ListingCard }) {
  const [when, setWhen] = useState(0);
  const [pending, start] = useTransition();
  const goChat = useGoChat();
  const router = useRouter();
  const first = l.seller.name.split(" ")[0];
  const send = () =>
    start(async () => {
      const r = await requestBuy(l.id, when);
      if (!r.ok) return void toast.error(r.formError);
      onOpenChange(false);
      toast("Request sent", { action: { label: "View deal", onClick: () => router.push("/deals") } });
      goChat(r.data.conversationId);
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon={l.price ? "bag" : "gift"} title={l.price ? "Confirm purchase" : "Ask for it"} subtitle={l.title}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="ctxprod">
          <PhotoTile l={l} />
          <div style={{ flex: 1 }}>
            <b>{l.price ? fmt(l.price) : "Free"}</b>
            {l.mrp && l.price ? <span className="mrp">{fmt(l.mrp)}</span> : null}
            <div className="faint xs">
              from {l.seller.name} · {l.pickupHostel}
            </div>
          </div>
        </div>
        <span className="label">
          <Icon name="clock" />
          When can you pick it up?
        </span>
        <div className="chips" role="radiogroup" aria-label="Pickup time">
          {WHEN.map((x, i) => (
            <button key={x} type="button" role="radio" aria-checked={when === i} className={`chip ${when === i ? "on" : ""}`} onClick={() => setWhen(i)}>
              {x}
            </button>
          ))}
        </div>
        <div className="note">
          <Icon name="wallet" />
          <span>Nothing is charged here. Pay {first} by UPI or cash at the handover.</span>
        </div>
        <button type="button" className="btn block" onClick={send} disabled={pending}>
          {pending ? <span className="spin" /> : null}Send request to {first}
        </button>
      </div>
    </Sheet>
  );
}

export function OfferSheet({ open, onOpenChange, l }: Base & { l: ListingCard }) {
  const [amt, setAmt] = useState(String(Math.round((l.price * 0.9) / 10) * 10));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const goChat = useGoChat();
  const first = l.seller.name.split(" ")[0];
  const send = () =>
    start(async () => {
      const v = Number(amt.replace(/\D/g, ""));
      if (!v) return setErr("Offer at least ₹1.");
      const c = await openChat(l.seller.id, l.id);
      if (!c.ok) return void toast.error(c.formError);
      const r = await sendOffer(c.data.id, v);
      if (!r.ok) return setErr(r.fieldErrors?.amount ?? r.formError ?? "Offer not sent.");
      onOpenChange(false);
      toast(`Offer of ${fmt(v)} sent to ${first}`);
      goChat(c.data.id);
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="tag" title="Make an offer" subtitle={`Asking ${fmt(l.price)}${l.mrp ? ` · original ${fmt(l.mrp)}` : ""}`}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="iwrap">
          <Icon name="rupee" className="icon i18" />
          <input
            className={`input ${err ? "bad" : ""}`}
            inputMode="numeric"
            value={amt}
            onChange={(e) => (setAmt(e.target.value.replace(/\D/g, "")), setErr(null))}
            aria-label="Offer amount"
            aria-invalid={!!err}
            style={{ fontSize: 22, fontWeight: 700 }}
          />
        </div>
        {err && (
          <span className="ferr" role="alert">
            <Icon name="alert" className="icon i14" />
            {err}
          </span>
        )}
        <div className="chips">
          {[5, 10, 15, 20].map((p) => {
            const v = Math.round((l.price * (1 - p / 100)) / 10) * 10;
            return (
              <button key={p} type="button" className="chip" onClick={() => setAmt(String(v))}>
                {p}% less · {fmt(v)}
              </button>
            );
          })}
        </div>
        <div className="note">
          <Icon name="info" />
          <span>{first} can accept, counter or decline. Offers above 85% of the asking price are usually accepted.</span>
        </div>
        <button type="button" className="btn block" onClick={send} disabled={pending}>
          {pending ? <span className="spin" /> : null}Send offer
        </button>
      </div>
    </Sheet>
  );
}

export function CloseAuctionSheet({ open, onOpenChange, l }: Base & { l: ListingDetail }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const goChat = useGoChat();
  const close = (bidId: string | null) =>
    start(async () => {
      const r = await closeAuction(l.id, bidId);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      onOpenChange(false);
      router.refresh();
      if (r.data.conversationId) goChat(r.data.conversationId);
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="hammer" title="Choose a buyer" subtitle="You can pick any bidder, not only the highest">
      <div className="lgroup" style={{ boxShadow: "none" }}>
        {l.bids.map((b) => (
          <button key={b.id} type="button" className="lrow" onClick={() => close(b.id)} disabled={pending}>
            <Avatar name={b.bidderName} size={36} />
            <span className="lt">
              <b>
                {b.bidderName} · {fmt(b.amount)}
              </b>
              <span>{ago(b.createdAt)}</span>
            </span>
            <Icon name="chev" />
          </button>
        ))}
        {!l.bids.length && <p className="faint pad">No bids yet.</p>}
        <button type="button" className="lrow" onClick={() => close(null)} disabled={pending}>
          <span className="li" style={{ color: "var(--bad)" }}>
            <Icon name="x" />
          </span>
          <span className="lt">
            <b>End without selling</b>
          </span>
        </button>
      </div>
    </Sheet>
  );
}

export function SoldSheet({ open, onOpenChange, l, chatters }: Base & { l: ListingCard; chatters: { id: string; name: string; hostel: string; avatarColor: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const sold = (buyer: string | null) =>
    start(async () => {
      const r = await markSold(l.id, buyer);
      if (!r.ok) return void toast.error(r.formError);
      toast(r.message);
      onOpenChange(false);
      router.push(buyer ? "/deals" : "/my-listings?tab=sold");
      router.refresh();
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="check" title="Who bought it?" subtitle='Other chats about this item get an automatic "sold" reply'>
      <div className="lgroup" style={{ boxShadow: "none" }}>
        {chatters.map((u) => (
          <button key={u.id} type="button" className="lrow" onClick={() => sold(u.id)} disabled={pending}>
            <Avatar name={u.name} color={u.avatarColor} size={36} />
            <span className="lt">
              <b>{u.name}</b>
              <span>{u.hostel}</span>
            </span>
            <Icon name="chev" />
          </button>
        ))}
        <button type="button" className="lrow" onClick={() => sold(null)} disabled={pending}>
          <span className="li">
            <Icon name="x" />
          </span>
          <span className="lt">
            <b>Sold outside i-bay</b>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
