/**
 * FEATURE: /login page [RUBRIC:AUTH] [RUBRIC:CAPTCHA]
 * WHAT: The same panel as the guest modal, on its own page. Protected pages
 *       send guests here with ?next=..., and they land back where they were.
 *       Google sign-ins from other domains come back with ?error=domain.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/session";
import { googleEnabled } from "@/lib/auth";
import { Peacock, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: "Only @iimidr.ac.in Google accounts can use i-bay. Try your campus account.",
  AccessDenied: "Only @iimidr.ac.in Google accounts can use i-bay. Try your campus account.",
  OAuthCallbackError: "Google sign-in was cancelled. Try again.",
  Configuration: "Sign-in is not set up correctly. Use the email code instead.",
  noaccount: "No account found for this Google email. Please create an account first.",
  exists: "An account with this email already exists. Please sign in instead.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const { next, error, mode } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getViewer()) redirect(safeNext);
  const initialMode = mode === "signup" ? "signup" : "signin";
  return (
    <div id="shell">
      <header className="tb">
        <div className="tb-row">
          <Link className="brand" href="/" aria-label="i-bay home">
            <Peacock size={30} />
            <Wordmark size={23} />
          </Link>
          <ThemeToggle className="ib thm" />
        </div>
      </header>
      <main style={{ display: "grid", placeItems: "center", minHeight: "calc(100dvh - 80px)", padding: 16 }}>
        <div className="authcard" style={{ animation: "none" }}>
          <Suspense>
            <LoginCard
              next={safeNext}
              mode={initialMode}
              googleEnabled={googleEnabled}
              initialError={error ? (ERRORS[error] ?? "Sign-in failed. Try again.") : null}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
