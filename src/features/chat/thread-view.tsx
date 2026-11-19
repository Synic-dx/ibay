"use client";
/**
 * FEATURE: A chat thread (full screen on phones, a pop-up window in the desktop dock)
 * WHAT: item context strip, "Deal agreed" bar, messages, structured offers
 *       (Accept / Decline, or type an amount and tap ₹ to counter), quick
 *       replies and the composer. Sends are optimistic: your bubble appears
 *       at once and is replaced by the saved one.
 */
import Link from "@/components/ui/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { fmt } from "@/lib/format";
import { PhotoTile, priceText } from "@/features/listings/components/parts";
import { fetchThread, respondOffer, sendMessage, sendOffer } from "./actions";
import type { ChatMessage, Thread } from "./queries";

const STATUS_TXT = { pending: "Waiting for reply", accepted: "Accepted", declined: "Declined", countered: "Countered" } as const;

export function ThreadView({ initial, compact = false }: { initial: Thread; compact?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["thread", initial.id], queryFn: () => fetchThread(initial.id), initialData: initial, refetchInterval: 15000 });
  const t = data ?? initial;
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const inputId = compact ? `dci-${t.id}` : "ci";

  const msgs = [...t.messages, ...optimistic];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const apply = (r: Awaited<ReturnType<typeof sendMessage>>) => {
    setOptimistic([]);
    if (!r.ok) return void toast.error(r.formError);
    qc.setQueryData(["thread", t.id], r.data);
    qc.invalidateQueries({ queryKey: ["threads"] });
  };
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setDraft("");
    setOptimistic([{ id: "tmp-" + Date.now(), kind: "text", body, amount: null, offerStatus: null, senderId: null, mine: true, createdAt: new Date().toISOString(), readAt: null }]);
    start(async () => apply(await sendMessage(t.id, body)));
  };
  const offer = () => {
    const amt = Number(draft.replace(/\D/g, ""));
    if (!amt) {
      toast("Type an amount, then tap ₹");
      document.getElementById(inputId)?.focus();
      return;
    }
    setDraft("");
    start(async () => apply(await sendOffer(t.id, amt)));
  };
  const respond = (id: string, ok: boolean) => start(async () => apply(await respondOffer(id, ok)));

  const quick = t.messages.length ? ["When can I pick it up?", "More photos?", "On my way", "Is the price final?"] : ["Is this still available?", "Is the price negotiable?", "Where do I pick it up?"];
  const first = t.other.name.split(" ")[0];

  return (
    <>
      {t.listing && (
        <Link className={compact ? "dk-ctx" : "ctxbar"} href={`/item/${t.listing.id}`}>
          <PhotoTile l={t.listing} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.listing.title}</b>
            <span className="faint">
              {t.listing.status === "deleted" ? "Listing deleted" : `${priceText(t.listing)}${t.listing.mrp ? ` · worth ${fmt(t.listing.mrp)} new` : ""}`}
            </span>
          </span>
          {!compact && <Icon name="chev" className="icon i18" />}
        </Link>
      )}
      {t.deal && (
        <div className="dealbar">
          <span className="row" style={{ gap: 6 }}>
            <Icon name="check" className="icon i16" strokeWidth={2.6} />
            Deal agreed · {fmt(t.deal.amount)}
          </span>
          <Link href="/deals" style={{ color: "inherit", fontWeight: 700, marginLeft: "auto" }}>
            Track ›
          </Link>
        </div>
      )}
      {t.other.whatsapp && !compact && (
        <div className="note" style={{ padding: "8px 14px" }}>
          <Icon name="chat" />
          <span>
            WhatsApp: <b className="mono">{t.other.whatsapp}</b>
          </span>
        </div>
      )}
      <div className={compact ? "dk-msgs msgs" : "msgs"} id={compact ? "dkm" : "msgs"} aria-live="polite">
        {msgs.length === 0 && (
          <div className="empty" style={{ padding: compact ? 20 : 40 }}>
            <span className="ei">
              <Icon name="chat" />
            </span>
            <h3>Say hi</h3>
            <p className="sm">Ask about condition, pickup time or price.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.kind === "offer" ? (
            <div className="ofr" key={m.id}>
              <span className="faint xs row" style={{ gap: 4 }}>
                <Icon name="tag" className="icon i14" />
                {m.mine ? "Your offer" : `${first} ${msgs.slice(0, i).some((x) => x.kind === "offer" && x.mine) ? "countered" : "offered"}`}
              </span>
              <b>{fmt(m.amount ?? 0)}</b>
              {m.offerStatus === "pending" && !m.mine ? (
                <>
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn small" onClick={() => respond(m.id, true)} disabled={pending}>
                      <Icon name="check" />
                      Accept
                    </button>
                    <button type="button" className="btn sec small" onClick={() => respond(m.id, false)} disabled={pending}>
                      Decline
                    </button>
                  </div>
                  <span className="faint xs">Or type another amount and tap the ₹ button to counter.</span>
                </>
              ) : (
                <span className="xs" style={{ color: m.offerStatus === "accepted" ? "var(--good)" : m.offerStatus === "declined" ? "var(--bad)" : "var(--ink-3)" }}>
                  {m.offerStatus ? STATUS_TXT[m.offerStatus] : ""}
                </span>
              )}
            </div>
          ) : m.kind === "system" ? (
            <div key={m.id} className="note" style={{ alignSelf: "center", maxWidth: "90%" }}>
              <Icon name="info" />
              <span>{m.body}</span>
            </div>
          ) : (
            <div key={m.id} className={`msg ${m.mine ? "me" : "them"}`} style={m.id.startsWith("tmp-") ? { opacity: 0.7 } : undefined}>
              {m.body}
            </div>
          ),
        )}
        {msgs.length > 0 && msgs[msgs.length - 1].mine && msgs[msgs.length - 1].readAt && <span className="faint xs" style={{ alignSelf: "flex-end" }}>Seen</span>}
        <div ref={end} />
      </div>
      <div className={compact ? "" : "composer"}>
        <div className={`qr ${compact ? "dk-qr" : ""}`}>
          {quick.slice(0, compact ? 3 : 4).map((q) => (
            <button key={q} type="button" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className={`cin ${compact ? "dk-cin" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {t.listing && (
            <button type="button" className="rb ofb" onClick={offer} aria-label="Send amount as an offer" title="Send as offer">
              <Icon name="rupee" />
            </button>
          )}
          <input id={inputId} placeholder="Message, or an amount to offer" aria-label="Message" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} />
          <button className="rb send" type="submit" aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
      </div>
    </>
  );
}
