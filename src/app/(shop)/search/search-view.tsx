"use client";
/**
 * FEATURE: Phone search screen
 * WHAT: Recent searches (kept in this browser), trending terms and categories;
 *       as you type, matching categories and listings appear.
 */
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { fmt } from "@/lib/format";
import { PhotoTile, priceText } from "@/features/listings/components/parts";
import { suggest } from "@/features/browse/actions";
import type { ListingCard } from "@/features/listings/types";

const KEY = "ibay-recent";

export function SearchView({ initial, categories }: { initial: string; categories: { id: string; name: string; description: string; icon: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [recent, setRecent] = useState<string[]>([]);
  const [res, setRes] = useState<{ cats: { id: string; name: string; icon: string }[]; items: ListingCard[] }>({ cats: [], items: [] });
  const [, start] = useTransition();

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => start(async () => setRes(await suggest(q))), 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (term: string) => {
    const v = term.trim();
    if (!v) return;
    const next = [v, ...recent.filter((x) => x !== v)].slice(0, 6);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: recent searches are only a convenience */
    }
    router.push(`/browse?q=${encodeURIComponent(v)}`);
  };

  return (
    <>
      <header className="tb">
        <div className="tb-row">
          <button type="button" className="ib" onClick={() => router.back()} aria-label="Back">
            <Icon name="back" />
          </button>
          <form
            style={{ flex: 1 }}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go(q);
            }}
          >
            <div className="iwrap">
              <Icon name="search" className="icon i18" />
              <input
                autoFocus
                name="q"
                type="search"
                className="input"
                style={{ minHeight: 44, paddingTop: 8, paddingBottom: 8 }}
                placeholder="Search i-bay…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search"
              />
            </div>
          </form>
          <ThemeToggle className="ib thm mthm" />
        </div>
      </header>
      <main>
        {!q.trim() ? (
          <>
            {recent.length > 0 && (
              <>
                <div className="label" style={{ margin: "6px 0 10px" }}>
                  <Icon name="clock" />
                  Recent
                </div>
                <div className="chips">
                  {recent.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => go(r)}>
                      <Icon name="clock" />
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="label" style={{ margin: "20px 0 10px" }}>
              <Icon name="grid" />
              Categories
            </div>
            <div className="lgroup">
              {categories.slice(0, 8).map((c) => (
                <Link key={c.id} className="lrow" href={`/browse?cat=${c.id}`}>
                  <span className="li">
                    <Icon name={c.icon} />
                  </span>
                  <span className="lt">
                    <b>{c.name}</b>
                    <span>{c.description}</span>
                  </span>
                  <Icon name="chev" />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="lgroup">
            {res.cats.map((c) => (
              <Link key={c.id} className="lrow" href={`/browse?cat=${c.id}`}>
                <span className="li">
                  <Icon name={c.icon} />
                </span>
                <span className="lt">
                  <b>{c.name}</b>
                  <span>Category</span>
                </span>
                <Icon name="chev" />
              </Link>
            ))}
            {res.items.map((l) => (
              <Link key={l.id} className="lrow" href={`/item/${l.id}`}>
                <span style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flex: "none" }}>
                  <PhotoTile l={l} style={{ width: 44, height: 44 }} />
                </span>
                <span className="lt">
                  <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</b>
                  <span>
                    {priceText(l)}
                    {l.mrp && l.mode !== "auction" ? ` · worth ${fmt(l.mrp)} new` : ""}
                  </span>
                </span>
              </Link>
            ))}
            <button type="button" className="lrow" onClick={() => go(q)}>
              <span className="li">
                <Icon name="search" />
              </span>
              <span className="lt">
                <b>See all results for &quot;{q}&quot;</b>
              </span>
              <Icon name="chev" />
            </button>
          </div>
        )}
      </main>
    </>
  );
}
