"use client";
/**
 * FEATURE: Your deals [RUBRIC:DATA-DISPLAY] [RUBRIC:EXTRA]
 * WHAT: Tabs All / Buying / Selling, one card per deal with a step tracker
 *       (Sale: Agreed -> Handed over -> Rate; Rental: Agreed -> Picked up ->
 *       Returned -> Rate), handover checks and the rating sheet.
 * RATING: labelled anchors (-10 Terrible ... +10 Perfect), a slider to fine
 *       tune, tags, a required reason (10 to 500 characters) and a live preview
 *       of how the other person's Plume will change.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useApp } from "@/components/app-context";
import { ago, fmt } from "@/lib/format";
import { plumeDelta } from "@/lib/plume";
import { PhotoTile } from "@/features/listings/components/parts";
import { useOpenChat } from "@/features/chat/use-open-chat";
import { advanceDeal, rateDeal } from "./actions";
import { canRate, stagesFor, type Deal } from "./stages";

const ANCH: [number, string][] = [[-10, "Terrible"], [-5, "Bad"], [0, "Okay"], [5, "Good"], [10, "Perfect"]];
const TAGS_POS = ["On time", "As described", "Friendly", "Fair price", "Returned in good shape"];
const TAGS_NEG = ["Late", "Not as described", "Damaged it", "No show", "Rude", "Did not reply"];

function HandoverSheet({ d, onClose }: { d: Deal; onClose: () => void }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(true);
  const [money, setMoney] = useState(true);
  const [pending, start] = useTransition();
  const next = stagesFor(d.kind)[d.stage + 1];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} icon="check" title={`Confirm: ${next.toLowerCase()}`} subtitle={next === "Returned" ? "Check the item together before the deposit goes back" : "Take 2 or 3 photos together. They protect both of you."}>
      <div className="stack" style={{ gap: 12 }}>
        {(
          [
            ["camera", "We took condition photos", photos, setPhotos],
            ["wallet", next === "Returned" ? "Deposit returned" : "Payment done (UPI or cash)", money, setMoney],
          ] as const
        ).map(([i, t, v, set]) => (
          <label key={t} className="between" style={{ padding: "12px 14px", borderRadius: 16, background: "var(--sunken)", boxShadow: "var(--shw)" }}>
            <span className="row">
              <Icon name={i} />
              {t}
            </span>
            <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} />
          </label>
        ))}
        <button
          type="button"
          className="btn block"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await advanceDeal(d.id, photos, money);
              if (!r.ok) return void toast.error(r.formError);
              toast(r.message);
              onClose();
              router.refresh();
            })
          }
        >
          Confirm
        </button>
      </div>
    </Sheet>
  );
}

function RateSheet({ d, onClose }: { d: Deal; onClose: () => void }) {
  const router = useRouter();
  const { viewer } = useApp();
  const [v, setV] = useState<number | null>(d.myRating?.score ?? null);
  const [tags, setTags] = useState<string[]>(d.myRating?.tags ?? []);
  const [why, setWhy] = useState(d.myRating?.reason ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = d.other.name.split(" ")[0];
  const delta = v == null ? 0 : plumeDelta(d.other.ratedDeals, v, viewer?.plume ?? 0);
  const tagList = v == null ? [] : v >= 0 ? TAGS_POS : TAGS_NEG;
  const toggleTag = (t: string) => {
    if (tags.includes(t)) return setTags(tags.filter((x) => x !== t));
    setTags([...tags, t]);
    if (!why.includes(t)) setWhy((w) => (w ? w.replace(/\.?\s*$/, ". ") : "") + t + ".");
  };
  const submit = () =>
    start(async () => {
      if (why.trim().length < 10) return setErr("Tell people why in at least 10 characters.");
      const r = await rateDeal({ transactionId: d.id, score: v!, reason: why, tags });
      if (!r.ok) return setErr(r.fieldErrors?.reason ?? r.formError ?? "Couldn't save the rating.");
      toast(`Thanks. Your rating is on ${first}'s profile.`);
      onClose();
      router.refresh();
    });
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} icon="star" title={`How was ${first}?`} subtitle={d.listing.title}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="anchors" role="radiogroup" aria-label="Rating">
          {ANCH.map(([n, t]) => (
            <button key={n} type="button" role="radio" aria-checked={v === n} className={`anc ${v === n ? "on" : ""}`} onClick={() => (setV(n), setTags([]))}>
              <b style={{ color: n > 0 ? "var(--good)" : n < 0 ? "var(--bad)" : "var(--ink-2)" }}>
                {n > 0 ? "+" : ""}
                {n}
              </b>
              {t}
            </button>
          ))}
        </div>
        {v != null ? (
          <>
            <div className="field">
              <div className="between">
                <label className="label" htmlFor="rate-slider">
                  Fine tune
                </label>
                <b className="mono" style={{ color: v > 0 ? "var(--good)" : v < 0 ? "var(--bad)" : "var(--ink)" }}>
                  {v > 0 ? "+" : ""}
                  {v}
                </b>
              </div>
              <input id="rate-slider" type="range" min={-10} max={10} value={v} onChange={(e) => setV(Number(e.target.value))} aria-valuetext={`${v}`} />
            </div>
            <div className="field">
              <span className="label">What stood out?</span>
              <div className="chips">
                {tagList.map((t) => (
                  <button key={t} type="button" className={`chip ${tags.includes(t) ? "on" : ""}`} aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="rw">
                Why this rating? (required)
              </label>
              <textarea id="rw" className={`input ${err ? "bad" : ""}`} placeholder={v < 0 ? "e.g. Returned the cooler with a broken fan" : "e.g. On time and exactly as shown"} value={why} onChange={(e) => (setWhy(e.target.value), setErr(null))} maxLength={500} aria-invalid={!!err} aria-describedby="rw-hint" />
              <span className="fhint" id="rw-hint">
                <span>At least 10 characters</span>
                <span className="cnt-txt">{why.length}/500</span>
              </span>
              {err && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{err}</span>}
            </div>
            <div className="note">
              <Icon name="trend" />
              <span>
                {first}&apos;s Plume: <b>{Math.round(d.other.plume)}</b> → <b style={{ color: delta >= 0 ? "var(--good)" : "var(--bad)" }}>{Math.round(d.other.plume + delta)}</b> ({delta >= 0 ? "+" : ""}
                {delta})
              </span>
            </div>
            <button type="button" className="btn block" disabled={why.trim().length < 10 || pending} onClick={submit}>
              {d.myRating ? "Update rating" : "Submit rating"}
            </button>
          </>
        ) : (
          <p className="faint sm" style={{ textAlign: "center" }}>
            Pick one, then fine tune.
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function DealsView({ deals, tab }: { deals: Deal[]; tab: string }) {
  const { open: openChat } = useOpenChat();
  const [handover, setHandover] = useState<Deal | null>(null);
  const [rate, setRate] = useState<Deal | null>(null);
  const tabs = { all: deals, buying: deals.filter((d) => d.role === "buyer"), selling: deals.filter((d) => d.role === "seller") };
  const list = tabs[(tab as keyof typeof tabs) in tabs ? (tab as keyof typeof tabs) : "all"];
  return (
    <>
      <nav className="seg" style={{ marginBottom: 14 }} aria-label="Deal tabs">
        {(["all", "buying", "selling"] as const).map((k) => (
          <Link key={k} href={`/deals?tab=${k}`} aria-current={tab === k ? "page" : undefined} style={{ flex: 1, minHeight: 38, borderRadius: 999, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: tab === k ? "var(--brand-ink)" : "var(--ink-2)", background: tab === k ? "var(--surface)" : undefined, boxShadow: tab === k ? "var(--shr)" : undefined }}>
            {k[0].toUpperCase() + k.slice(1)} ({tabs[k].length})
          </Link>
        ))}
      </nav>
      <div className="stack" style={{ gap: 12 }}>
        {list.map((d) => {
          const st = stagesFor(d.kind);
          const last = st.length - 1;
          const rated = Boolean(d.myRating);
          const editable = d.myRating && new Date(d.myRating.editableUntil) > new Date();
          return (
            <div className="panel pad stack" style={{ gap: 10 }} key={d.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <Link href={`/item/${d.listing.id}`} style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", flex: "none" }}>
                  <PhotoTile l={d.listing} style={{ width: 60, height: 60 }} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b className="sm" style={{ display: "block" }}>
                    {d.listing.title}
                  </b>
                  <span className="xs muted">
                    {d.role === "buyer" ? "From" : "To"} {d.other.name} · {fmt(d.amount)}
                    {d.kind === "rental" ? ` + ${fmt(d.deposit)} deposit` : ""}
                  </span>
                  <br />
                  <span className="xs faint">{ago(d.createdAt)}</span>
                </div>
                <button type="button" className="ib" onClick={() => openChat(d.other.id, d.listing.id)} aria-label={`Chat with ${d.other.name}`}>
                  <Icon name="chat" />
                </button>
              </div>
              <ol className="steps" aria-label="Deal progress">
                {st.map((s, i) => {
                  const done = i <= d.stage || (i === last && rated);
                  const cur = i === d.stage + 1;
                  return [
                    i ? <span key={`l${i}`} className={`st-l ${done ? "done" : ""}`} aria-hidden="true" /> : null,
                    <li key={s} className={`st ${done ? "done" : cur ? "cur" : ""}`} aria-current={cur ? "step" : undefined} style={{ listStyle: "none" }}>
                      <i>{done ? <Icon name="check" strokeWidth={3} /> : null}</i>
                      {s}
                    </li>,
                  ];
                })}
              </ol>
              {rated ? (
                <span className="sm faint row" style={{ gap: 4 }}>
                  <Icon name="check" className="icon i16" />
                  You rated {d.myRating!.score > 0 ? "+" : ""}
                  {d.myRating!.score}
                  {editable && (
                    <button type="button" className="btn quiet small" onClick={() => setRate(d)}>
                      Edit (24 h)
                    </button>
                  )}
                </span>
              ) : canRate(d) ? (
                <button type="button" className="btn block" onClick={() => setRate(d)}>
                  <Icon name="star" />
                  Rate {d.other.name.split(" ")[0]}
                </button>
              ) : (
                <button type="button" className="btn sec block" onClick={() => setHandover(d)}>
                  <Icon name="check" />
                  Mark {st[d.stage + 1].toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="empty">
            <span className="ei">
              <Icon name="bag" />
            </span>
            <h3>No deals yet</h3>
            <p className="sm">Buy, rent or sell something to see it here.</p>
          </div>
        )}
      </div>
      {handover && <HandoverSheet d={handover} onClose={() => setHandover(null)} />}
      {rate && <RateSheet d={rate} onClose={() => setRate(null)} />}
    </>
  );
}
