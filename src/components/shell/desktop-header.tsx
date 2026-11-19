"use client";
/**
 * FEATURE: Desktop header (>= 1080px) [RUBRIC:RESPONSIVE]
 * WHAT: Classic e-commerce header like Amazon / Flipkart:
 *   row 1: logo, "Meet at <hostel>", search with a Material-style category menu,
 *          Account, Saved, Chats, Alerts, Sell and the theme toggle (far right)
 *   row 2: "All categories" mega menu + quick category links
 *   row 3: the LIVE ticker
 * Hidden below 1080px by CSS (phones and tablets use the top bar + tab bar).
 */
import Link from "@/components/ui/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Avatar, Peacock, Wordmark } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { ThemeToggle } from "./theme-toggle";
import { LiveStrip } from "./live-strip";
import { HostelSheet } from "./hostel-sheet";
import { UspNavChips } from "./usp-nav";
import type { Category, Collection } from "@/features/shell/queries";
import type { ListingCard } from "@/features/listings/types";

const GROUPS = ["Seasons", "Study", "Hostel life", "Play"];
const GROUP_ICON: Record<string, string> = { Seasons: "cal", Study: "grad", "Hostel life": "bed", Play: "trophy" };
const QUICK: [string, string][] = [
  ["preprocess", "Getups"], ["formals", "Formals"], ["ethnic", "Ethnic"], ["clothing", "Fashion"], ["gadgets", "Gadgets"],
  ["sports", "Sports"], ["gym", "Gym Corner"], ["books", "Books"], ["exam", "CFA & CAT"], ["reads", "Manga & Novels"],
  ["room", "Room"], ["appliances", "Appliances"], ["free", "Free"],
];

type Props = { categories: Category[]; collections: Collection[]; drops: ListingCard[]; auctions: ListingCard[] };

export function DesktopHeader({ categories, collections, drops, auctions }: Props) {
  const { viewer, counts, openAuth, flags } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [cat, setCat] = useState(sp.get("cat") ?? "all");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [hostelOpen, setHostelOpen] = useState(false);
  const current = categories.find((c) => c.id === cat);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (cat !== "all") params.set("cat", cat);
    router.push(`/browse?${params}`);
  };
  const gated = (reason: string, href: string) => (e: React.MouseEvent) => {
    if (!viewer) {
      e.preventDefault();
      openAuth({ reason, next: href });
    }
  };
  const browseOn = (id: string) => pathname === "/browse" && sp.get("cat") === id && !sp.get("q");

  return (
    <header className="dh">
      <div className="dh-top">
        <div className="dh-in">
          <Link className="brand" href="/" aria-label="i-bay home">
            <Peacock size={34} />
            <Wordmark size={28} />
          </Link>
          <button
            type="button"
            className="dloc"
            onClick={() => (viewer ? setHostelOpen(true) : openAuth({ reason: "Sign in to set your hostel as your pickup point" }))}
          >
            <Icon name="pin" />
            <span>
              <small>Meet at</small>
              <b>{viewer ? viewer.hostel : "IIM Indore campus"}</b>
            </span>
          </button>

          <form className="dsearch" onSubmit={submit} role="search">
            <div className="dsc">
              <Menu.Root modal={false}>
                <Menu.Trigger className="dsc-b" aria-label="Search in category">
                  <Icon name={current ? current.icon : "grid"} className="icon i16" />
                  <span>{current ? current.short : "All"}</span>
                  <Icon name="down" className="icon i14 dsc-chev" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content className="dsc-m" align="start" sideOffset={10} style={{ zIndex: 90 }}>
                    <Menu.RadioGroup value={cat} onValueChange={setCat} style={{ display: "contents" }}>
                      <div className="dsc-all">
                        <Menu.RadioItem value="all" className="dsc-i">
                          <Icon name="grid" className="icon i16" />
                          <span>All of i-bay</span>
                          <Menu.ItemIndicator>
                            <Icon name="check" className="icon i16" strokeWidth={2.6} />
                          </Menu.ItemIndicator>
                        </Menu.RadioItem>
                      </div>
                      {GROUPS.map((g) => (
                        <div className="dsc-g" key={g}>
                          <span className="dsc-h">{g}</span>
                          {categories
                            .filter((c) => c.group === g)
                            .map((c) => (
                              <Menu.RadioItem key={c.id} value={c.id} className="dsc-i">
                                <Icon name={c.icon} className="icon i16" />
                                <span>{c.short}</span>
                                <Menu.ItemIndicator>
                                  <Icon name="check" className="icon i16" strokeWidth={2.6} />
                                </Menu.ItemIndicator>
                              </Menu.RadioItem>
                            ))}
                        </div>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            </div>
            <input
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search racquets, whey, formals, gadgets, books…"
              aria-label="Search i-bay"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" aria-label="Search">
              <Icon name="search" />
            </button>
          </form>

          <nav className="dact" aria-label="Account">
            {viewer ? (
              <Link className="dact-b dacc" href="/you">
                <Avatar name={viewer.name} url={viewer.avatarUrl} color={viewer.avatarColor} size={28} />
                <span>
                  <small>Hi, {viewer.name.split(" ")[0]}</small>
                  <b>Account</b>
                </span>
              </Link>
            ) : (
              <button type="button" className="dact-b dacc" onClick={() => openAuth({})}>
                <Icon name="user" />
                <span>
                  <small>Hello, guest</small>
                  <b>Sign in</b>
                </span>
              </button>
            )}
            <Link className="dact-b" href="/map" title="Browse listings on 3D campus map">
              <Icon name="pin" />
              <span>Map</span>
            </Link>
            <Link className="dact-b" href="/saved" onClick={gated("Sign in to see your saved items", "/saved")}>
              <Icon name="heart" />
              <span>Saved</span>
              {viewer && counts.saved > 0 && <i className="cnt">{counts.saved}</i>}
            </Link>
            <Link className="dact-b" href="/messages" onClick={gated("Sign in to chat with buyers and sellers", "/messages")}>
              <Icon name="chat" />
              <span>Chats</span>
              {viewer && counts.unreadChats > 0 && <i className="cnt">{counts.unreadChats}</i>}
            </Link>
            {viewer && (
              <Link className="dact-b" href="/notifications">
                <Icon name="bell" />
                <span>Alerts</span>
                {counts.unreadNotifs > 0 && <i className="cnt">{counts.unreadNotifs}</i>}
              </Link>
            )}
            <Link className="btn dsell" href="/sell" onClick={gated("Sign in to list something on i-bay", "/sell")}>
              <Icon name="plus" />
              Sell
            </Link>
            <ThemeToggle className="ib thm dthm" />
          </nav>
        </div>
      </div>

      <div className="dcats">
        <div className="dh-in">
          <div className="dmega">
            <Link className="dall" href="/explore">
              <Icon name="grid" className="icon i16" />
              All categories
              <Icon name="down" className="icon i14" />
            </Link>
            <div className="dmenu">
              {GROUPS.map((g) => (
                <div key={g}>
                  <h5>
                    <Icon name={GROUP_ICON[g]} className="icon i16" />
                    {g}
                  </h5>
                  {categories
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <Link key={c.id} href={`/browse?cat=${c.id}`}>
                        {c.name}
                      </Link>
                    ))}
                </div>
              ))}
              <div>
                <h5>
                  <Icon name="sparkles" className="icon i16" />
                  Collections
                </h5>
                {collections.map((c) => (
                  <Link key={c.id} href={`/browse?coll=${c.id}`}>
                    {c.name}
                  </Link>
                ))}
                <Link href="/browse?modes=rent">All rentals</Link>
                <Link href="/browse?sort=off">Biggest discounts</Link>
              </div>
            </div>
          </div>
          <UspNavChips />
          <span className="dusp-div" aria-hidden="true" />
          <div className="dscroll">
            {QUICK.map(([k, n]) => (
              <Link key={k} href={`/browse?cat=${k}`} className={browseOn(k) ? "on" : ""}>
                {n}
              </Link>
            ))}
            <Link href="/requests" onClick={gated("Sign in to see requests", "/requests")}>
              Looking for
            </Link>
          </div>
        </div>
      </div>
      {(drops.length > 0 || auctions.length > 0) && (
        <div className="dlive">
          <div className="dh-in">
            <LiveStrip drops={drops} auctions={auctions} />
          </div>
        </div>
      )}
      {viewer && <HostelSheet open={hostelOpen} onOpenChange={setHostelOpen} current={viewer.hostel} />}
    </header>
  );
}
