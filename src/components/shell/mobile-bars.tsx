"use client";
/**
 * FEATURE: Phone and tablet chrome (< 1080px) [RUBRIC:RESPONSIVE]
 * WHAT: <RootBar> is the sticky glass top bar on Home/Explore (menu, logo,
 *       bell/avatar or Sign in, theme toggle). <SubBar> is the back + title bar
 *       on inner pages (on desktop it turns into a plain page title row).
 *       <TabBar> is the bottom bar: Home, Explore, Map, Sell, Saved, Chats, You.
 */
import Link from "@/components/ui/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar, Peacock, Wordmark } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { ThemeToggle } from "./theme-toggle";

export function RootBar({ children }: { children?: ReactNode }) {
  const { viewer, counts, openAuth, setDrawerOpen, flags } = useApp();
  return (
    <header className="tb root">
      <div className="tb-row">
        <button type="button" className="ib" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <Link className="brand" href="/" aria-label="i-bay home">
          <Peacock size={30} />
          <Wordmark size={23} />
        </Link>
        {viewer ? (
          <>
            <Link className="ib" href="/notifications" aria-label="Notifications">
              <Icon name="bell" />
              {counts.unreadNotifs > 0 && <span className="cnt">{counts.unreadNotifs}</span>}
            </Link>
            <Link className="ib" href="/you" aria-label="Your profile">
              <Avatar name={viewer.name} url={viewer.avatarUrl} color={viewer.avatarColor} size={30} />
            </Link>
          </>
        ) : (
          <button type="button" className="signin" onClick={() => openAuth({})}>
            <Icon name="user" className="icon i16" />
            Sign in
          </button>
        )}
        <ThemeToggle className="ib thm mthm" />
      </div>
      {children}
    </header>
  );
}

/** Back button + title. `backHref` is used when there is no history (opened from a link). */
export function SubBar({ title, sub, actions, backHref = "/" }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; backHref?: string }) {
  const router = useRouter();
  return (
    <header className="tb">
      <div className="tb-row">
        <button
          type="button"
          className="ib"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref))}
        >
          <Icon name="back" />
        </button>
        <h1 className="tb-title">
          {title}
          {sub ? <small>{sub}</small> : null}
        </h1>
        {actions}
        <ThemeToggle className="ib thm mthm" />
      </div>
    </header>
  );
}

const HIDE_TABS = [/^\/item\//, /^\/messages\/.+/, /^\/sell/, /^\/listings\/.+\/edit/, /^\/requests\/.+/, /^\/login/];

export function TabBar() {
  const { viewer, counts, openAuth } = useApp();
  const path = usePathname();
  if (HIDE_TABS.some((re) => re.test(path))) return null;
  const on = (p: string) => (p === "/" ? path === "/" : path.startsWith(p)) ? "on" : "";
  const gate = (reason: string, href: string) => (e: React.MouseEvent) => {
    if (!viewer) {
      e.preventDefault();
      openAuth({ reason, next: href });
    }
  };
  return (
    <nav className="tabbar" aria-label="Main">
      <Link className={`tab ${on("/")}`} href="/">
        <Icon name="home" />
        Home
      </Link>
      <Link className={`tab ${on("/explore")}`} href="/explore">
        <Icon name="compass" />
        Explore
      </Link>
      <Link className={`tab ${on("/map")}`} href="/map">
        <Icon name="pin" />
        Map
      </Link>
      <Link className="tab" href="/sell" aria-label="Sell" onClick={gate("Sign in to list something on i-bay", "/sell")}>
        <span className="sellfab">
          <Icon name="plus" strokeWidth={2.6} />
        </span>
        Sell
      </Link>
      <Link className={`tab ${on("/saved")}`} href="/saved" onClick={gate("Sign in to see your saved items", "/saved")}>
        <Icon name="heart" />
        {viewer && counts.saved > 0 && <span className="cnt">{counts.saved}</span>}
        Saved
      </Link>
      <Link className={`tab ${on("/messages")}`} href="/messages" onClick={gate("Sign in to chat with buyers and sellers", "/messages")}>
        <Icon name="chat" />
        {viewer && counts.unreadChats > 0 && <span className="cnt">{counts.unreadChats}</span>}
        Chats
      </Link>
      <Link className={`tab ${on("/you")}`} href="/you" onClick={gate("Sign in to see your profile, deals and saved items", "/you")}>
        {viewer ? <Avatar name={viewer.name} url={viewer.avatarUrl} color={viewer.avatarColor} size={20} /> : <Icon name="user" />}
        You
      </Link>
    </nav>
  );
}

/** The phone search pill that opens /search. */
export function SearchPill({ placeholder }: { placeholder?: string }) {
  return (
    <Link className="spill" href="/search">
      <Icon name="search" className="icon i18" />
      <span>{placeholder ?? "Search Yonex racquets, sarees, whey…"}</span>
      <span className="go">
        <Icon name="arrow" />
      </span>
    </Link>
  );
}
