"use client";
/**
 * FEATURE: App-wide client state
 * WHAT: Who is signed in (a small, safe summary), the guest auth gate
 *       ("Sign in to see full details...") and which overlay is open
 *       (Mayu, mobile drawer). Every client component reads it with useApp().
 * WHY: guests can browse everything, but tapping Save, Sell, Chats, Bid or a
 *      product opens the blurred auth modal and, after signing in, resumes the
 *      action they wanted (the `next` URL).
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

export type ViewerSummary = {
  id: string;
  name: string;
  email: string;
  hostel: string;
  room: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  plume: number;
  ratedDeals: number;
  role: "user" | "admin";
  onboarded: boolean;
  channel: string;
};

export type AuthGate = {
  reason?: string;
  next?: string;
  listing?: { title: string; photo: string | null; price: string } | null;
  mode?: "signin" | "signup";
};

type Ctx = {
  viewer: ViewerSummary | null;
  counts: { unreadChats: number; unreadNotifs: number; saved: number };
  flags: { google: boolean; captchaOff: boolean };
  auth: AuthGate | null;
  openAuth: (g?: AuthGate) => void;
  closeAuth: () => void;
  mayuOpen: boolean;
  setMayuOpen: (v: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({
  viewer,
  counts,
  flags,
  children,
}: {
  viewer: ViewerSummary | null;
  counts: Ctx["counts"];
  flags: Ctx["flags"];
  children: ReactNode;
}) {
  const [auth, setAuth] = useState<AuthGate | null>(null);
  const [mayuOpen, setMayuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openAuth = useCallback((g: AuthGate = {}) => {
    setDrawerOpen(false);
    setAuth(g);
  }, []);
  const closeAuth = useCallback(() => setAuth(null), []);
  const value = useMemo(
    () => ({ viewer, counts, flags, auth, openAuth, closeAuth, mayuOpen, setMayuOpen, drawerOpen, setDrawerOpen }),
    [viewer, counts, flags, auth, openAuth, closeAuth, mayuOpen, drawerOpen],
  );
  return <AppCtx value={value}>{children}</AppCtx>;
}

/** Reads the app context. */
export function useApp(): Ctx {
  const c = use(AppCtx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

/**
 * Runs `fn` if signed in, otherwise opens the auth modal with a reason.
 * @returns a click handler
 */
export function useGate() {
  const { viewer, openAuth } = useApp();
  return useCallback(
    (reason: string, fn: () => void, next?: string) => () => {
      if (viewer) fn();
      else openAuth({ reason, next });
    },
    [viewer, openAuth],
  );
}
