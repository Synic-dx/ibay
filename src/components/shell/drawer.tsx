"use client";
/**
 * FEATURE: Phone side drawer (hamburger menu)
 * WHAT: Shop links, collapsible category groups, "You" links and settings.
 *       Hidden on desktop (the header has everything).
 */
import Link from "@/components/ui/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "@/components/ui/icon";
import { Avatar, Peacock, Wordmark } from "@/components/brand";
import { useApp } from "@/components/app-context";
import { trustLevel } from "@/lib/plume";
import { ThemeSwitchRow } from "./theme-toggle";
import { signOutAction } from "@/features/auth/actions";
import type { Category } from "@/features/shell/queries";

const GROUPS = ["Seasons", "Study", "Hostel life", "Play"];
const GROUP_ICON: Record<string, string> = { Seasons: "cal", Study: "grad", "Hostel life": "bed", Play: "trophy" };

export function Drawer({ categories, liveDrops }: { categories: Category[]; liveDrops: number }) {
  const { viewer, drawerOpen, setDrawerOpen, openAuth, setMayuOpen, counts } = useApp();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const close = () => setDrawerOpen(false);
  const dl = (icon: string, text: string, href: string, end?: string | number, hot = false) => (
    <Link className={`dl ${hot ? "hot" : ""}`} href={href} onClick={close}>
      <Icon name={icon} />
      <span>{text}</span>
      {end ? <span className="end">{end}</span> : null}
    </Link>
  );
  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="drawer" aria-label="Menu">
          <Dialog.Title className="vh">Menu</Dialog.Title>
          <Dialog.Description className="vh">Shop links, categories and settings</Dialog.Description>
          <div className="dhead">
            {viewer ? (
              <div className="row">
                <Avatar name={viewer.name} url={viewer.avatarUrl} color={viewer.avatarColor} size={48} />
                <div>
                  <b style={{ fontSize: 16 }}>{viewer.name}</b>
                  <div className="xs" style={{ opacity: 0.85 }}>
                    {trustLevel(viewer.plume, viewer.ratedDeals).label} · Plume {Math.round(viewer.plume)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="row">
                  <Peacock size={40} />
                  <Wordmark size={26} />
                </div>
                <p className="sm" style={{ margin: "10px 0 12px", opacity: 0.85 }}>
                  Browse freely. Sign in with your IIM Indore account to buy, rent or sell.
                </p>
                <button type="button" className="btn mint small" onClick={() => openAuth({})}>
                  <Icon name="user" />
                  Sign in
                </button>
              </>
            )}
          </div>
          <div className="dsec">Shop</div>
          {dl("home", "Home", "/")}
          {dl("grid", "All categories", "/explore")}
          {dl("pin", "Campus Map", "/map", "3D Map", true)}
          {dl("drama", "Preprocess Store", "/browse?cat=preprocess", "Hourly", true)}
          {dl("dumbbell", "Gym Corner", "/browse?cat=gym")}
          {dl("hammer", "Live auctions", "/browse?modes=auction")}
          {dl("repeat", "Rentals", "/browse?modes=rent")}
          {dl("flame", "Food drops", "/browse?cat=food", liveDrops ? `${liveDrops} live` : "")}
          {dl("book", "Novels & manga", "/browse?cat=reads")}
          {dl("gift", "Free stuff", "/browse?cat=free")}
          {viewer ? (
            dl("list", "Looking for...", "/requests")
          ) : (
            <button type="button" className="dl" onClick={() => openAuth({ reason: "Sign in to see and post requests", next: "/requests" })}>
              <Icon name="list" />
              <span>Looking for...</span>
            </button>
          )}
          <div className="dsec">Categories</div>
          {GROUPS.map((g) => (
            <div key={g}>
              <button type="button" className="dl" aria-expanded={!!open[g]} onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}>
                <Icon name={GROUP_ICON[g]} />
                <span>{g}</span>
                <span className="end">
                  <Icon name={open[g] ? "down" : "chev"} className="icon i16" />
                </span>
              </button>
              {open[g] &&
                categories
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <Link key={c.id} className="dl dsub" href={`/browse?cat=${c.id}`} onClick={close}>
                      {c.name}
                    </Link>
                  ))}
            </div>
          ))}
          {viewer && (
            <>
              <div className="dsec">You</div>
              {dl("bag", "Your deals", "/deals")}
              {dl("heart", "Saved", "/saved", counts.saved || "")}
              {dl("store", "My listings", "/my-listings")}
              {dl("pin", "Hostel & contact", "/account")}
              {dl("bell", "Notifications", "/notifications", counts.unreadNotifs || "")}
              {viewer.role === "admin" && dl("shieldAlert", "Admin", "/admin")}
            </>
          )}
          <div className="dsec">More</div>
          <ThemeSwitchRow className="dl" />
          {dl("help", "How Plume works", "/trust")}
          <button
            type="button"
            className="dl"
            onClick={() => {
              close();
              setMayuOpen(true);
            }}
          >
            <Icon name="sparkles" />
            <span>Ask Mayu</span>
          </button>
          {viewer && (
            <form action={signOutAction}>
              <button type="submit" className="dl">
                <Icon name="logout" />
                <span>Sign out</span>
              </button>
            </form>
          )}
          <p className="faint xs" style={{ padding: 18 }}>
            i-bay is only for verified @iimidr.ac.in accounts.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
