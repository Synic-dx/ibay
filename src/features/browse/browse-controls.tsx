"use client";
/**
 * FEATURE: Browse filters, sort and removable chips [RUBRIC:DATA-DISPLAY]
 * WHAT: Quick chips (Filters, Sort, My hostel, Rent / Buy / Auction, Under 6 mo,
 *       Trusted), a Filters sheet (deal type, hostel, trusted, available on,
 *       size, age, price range) and a Sort sheet. Every change updates the URL.
 */
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useApp } from "@/components/app-context";
import { dayLabel, istDay } from "@/lib/format";
import { browseQuery, filterCount, SORTS, type BrowseState } from "./params";

const ymd = (offset: number) => istDay(offset).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function BrowseControls({ state, sizes, total }: { state: BrowseState; sizes: string[]; total: number }) {
  const router = useRouter();
  const path = usePathname();
  const { viewer, openAuth } = useApp();
  const [, start] = useTransition();
  const [filters, setFilters] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState(state);

  const go = (s: Partial<BrowseState>) => start(() => router.replace(path + browseQuery({ ...state, page: 1, ...s }), { scroll: false }));
  const togMode = (m: string) => go({ modes: state.modes.includes(m) ? state.modes.filter((x) => x !== m) : [...state.modes, m] });
  const n = filterCount(state);
  const sortName = SORTS.find(([k]) => k === state.sort)?.[1] ?? "Best match";

  // Removable chips for whatever is active.
  const chips: [string, Partial<BrowseState>][] = [
    ...state.modes.map((m): [string, Partial<BrowseState>] => [{ sell: "Buy", rent: "Rent", auction: "Auction", drop: "Food drop" }[m] ?? m, { modes: state.modes.filter((x) => x !== m) }]),
    ...(state.near ? [["My hostel", { near: false }] as [string, Partial<BrowseState>]] : []),
    ...(state.trusted ? [["Well-rated sellers", { trusted: false }] as [string, Partial<BrowseState>]] : []),
    ...(state.avail ? [[`Free on ${state.avail}`, { avail: "" }] as [string, Partial<BrowseState>]] : []),
    ...(state.size ? [[`Size ${state.size}`, { size: "" }] as [string, Partial<BrowseState>]] : []),
    ...(state.age ? [[`Under ${state.age} months old`, { age: null }] as [string, Partial<BrowseState>]] : []),
    ...(state.min || state.max ? [[`₹${state.min || 0} to ${state.max ? "₹" + state.max : "any"}`, { min: "", max: "" }] as [string, Partial<BrowseState>]] : []),
  ];

  return (
    <>
      <div className="chiprow" role="toolbar" aria-label="Filters and sort">
        <button
          type="button"
          className={`chip ${n ? "on" : ""}`}
          onClick={() => {
            setDraft(state);
            setFilters(true);
          }}
        >
          <Icon name="filter" />
          Filters{n ? ` · ${n}` : ""}
        </button>
        <button type="button" className="chip" onClick={() => setSortOpen(true)}>
          <Icon name="sort" />
          {sortName}
          <Icon name="down" />
        </button>
        <button
          type="button"
          className={`chip ${state.near ? "on" : ""}`}
          aria-pressed={state.near}
          onClick={() => (viewer ? go({ near: !state.near }) : openAuth({ reason: "Sign in so we know your hostel" }))}
        >
          <Icon name="pin" />
          My hostel
        </button>
        {(
          [
            ["rent", "Rent", "repeat"],
            ["sell", "Buy", "bag"],
            ["auction", "Auction", "hammer"],
          ] as const
        ).map(([m, nm, i]) => (
          <button key={m} type="button" className={`chip ${state.modes.includes(m) ? "on" : ""}`} aria-pressed={state.modes.includes(m)} onClick={() => togMode(m)}>
            <Icon name={i} />
            {nm}
          </button>
        ))}
        <button type="button" className={`chip ${state.age === 6 ? "on" : ""}`} aria-pressed={state.age === 6} onClick={() => go({ age: state.age === 6 ? null : 6 })}>
          <Icon name="hourglass" />
          Under 6 mo old
        </button>
        <button type="button" className={`chip ${state.trusted ? "on" : ""}`} aria-pressed={state.trusted} onClick={() => go({ trusted: !state.trusted })}>
          <Icon name="shield" />
          Trusted
        </button>
      </div>

      {chips.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {chips.map(([label, patch]) => (
            <span className="fchip" key={label}>
              {label}
              <button type="button" aria-label={`Remove ${label}`} onClick={() => go(patch)}>
                <Icon name="x" className="icon i14" />
              </button>
            </span>
          ))}
          <button type="button" className="btn quiet small" style={{ minHeight: 30 }} onClick={() => go({ modes: [], near: false, trusted: false, avail: "", size: "", age: null, min: "", max: "" })}>
            Clear all
          </button>
        </div>
      )}

      <Sheet open={filters} onOpenChange={setFilters} title="Filters" icon="filter">
        <div className="stack" style={{ gap: 20 }}>
          <div className="field">
            <span className="label">
              <Icon name="bag" />
              Deal type
            </span>
            <div className="chips">
              {(
                [
                  ["sell", "Buy", "bag"],
                  ["rent", "Rent", "repeat"],
                  ["auction", "Auction", "hammer"],
                  ["drop", "Food drop", "flame"],
                ] as const
              ).map(([k, nm, i]) => (
                <button
                  key={k}
                  type="button"
                  className={`chip ${draft.modes.includes(k) ? "on" : ""}`}
                  aria-pressed={draft.modes.includes(k)}
                  onClick={() => setDraft({ ...draft, modes: draft.modes.includes(k) ? draft.modes.filter((x) => x !== k) : [...draft.modes, k] })}
                >
                  <Icon name={i} />
                  {nm}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="between" style={{ width: "100%" }} role="switch" aria-checked={draft.near} onClick={() => setDraft({ ...draft, near: !draft.near })}>
            <span className="row">
              <Icon name="pin" />
              In my hostel
            </span>
            <span className={`sw ${draft.near ? "on" : ""}`} />
          </button>
          <button type="button" className="between" style={{ width: "100%" }} role="switch" aria-checked={draft.trusted} onClick={() => setDraft({ ...draft, trusted: !draft.trusted })}>
            <span className="row">
              <Icon name="shield" />
              Well-rated sellers only
            </span>
            <span className={`sw ${draft.trusted ? "on" : ""}`} />
          </button>
          <div className="field">
            <span className="label">
              <Icon name="cal" />
              Available on
            </span>
            <div className="chiprow" style={{ margin: 0, padding: "2px 0 6px" }}>
              {[0, 1, 2, 3, 4, 5, 6].map((o) => (
                <button key={o} type="button" className={`chip ${draft.avail === ymd(o) ? "on" : ""}`} onClick={() => setDraft({ ...draft, avail: draft.avail === ymd(o) ? "" : ymd(o) })}>
                  {dayLabel(o, true)}
                </button>
              ))}
            </div>
          </div>
          {sizes.length > 0 && (
            <div className="field">
              <span className="label">
                <Icon name="ruler" />
                Size
              </span>
              <div className="chips">
                {sizes.map((z) => (
                  <button key={z} type="button" className={`chip ${draft.size === z ? "on" : ""}`} onClick={() => setDraft({ ...draft, size: draft.size === z ? "" : z })}>
                    {z}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <span className="label">
              <Icon name="hourglass" />
              Product age
            </span>
            <div className="chips">
              {(
                [
                  [6, "Under 6 months"],
                  [12, "Under 1 year"],
                  [24, "Under 2 years"],
                ] as const
              ).map(([m, nm]) => (
                <button key={m} type="button" className={`chip ${draft.age === m ? "on" : ""}`} onClick={() => setDraft({ ...draft, age: draft.age === m ? null : m })}>
                  {nm}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">
              <Icon name="rupee" />
              Price
            </span>
            <div className="row">
              <input className="input" inputMode="numeric" placeholder="Min" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/\D/g, "") })} aria-label="Minimum price" />
              <span className="faint">to</span>
              <input className="input" inputMode="numeric" placeholder="Max" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value.replace(/\D/g, "") })} aria-label="Maximum price" />
            </div>
          </div>
          <div className="row" style={{ position: "sticky", bottom: 0, background: "var(--surface)", paddingTop: 10 }}>
            <button type="button" className="btn sec" onClick={() => setDraft({ ...draft, modes: [], near: false, trusted: false, avail: "", size: "", age: null, min: "", max: "" })}>
              Clear
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => {
                if (draft.near && !viewer) return openAuth({ reason: "Sign in so we know your hostel" });
                setFilters(false);
                go(draft);
              }}
            >
              Show results
            </button>
          </div>
          <span className="faint xs">Currently {total} item{total === 1 ? "" : "s"}.</span>
        </div>
      </Sheet>

      <Sheet open={sortOpen} onOpenChange={setSortOpen} title="Sort by" icon="sort">
        <div className="lgroup" style={{ boxShadow: "none" }} role="radiogroup" aria-label="Sort by">
          {SORTS.map(([k, nm, i]) => (
            <button
              key={k}
              type="button"
              className="lrow"
              role="radio"
              aria-checked={state.sort === k}
              onClick={() => {
                setSortOpen(false);
                go({ sort: k });
              }}
            >
              <span className="li">
                <Icon name={i} />
              </span>
              <span className="lt">
                <b>{nm}</b>
              </span>
              {state.sort === k && <Icon name="check" strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
