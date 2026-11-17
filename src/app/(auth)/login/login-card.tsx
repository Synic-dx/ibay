"use client";
/** The sign-in panel on the /login page (redirects to `next` when done). */
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/features/auth/auth-panel";

export function LoginCard({ next, googleEnabled, initialError }: { next: string; googleEnabled: boolean; initialError: string | null }) {
  const router = useRouter();
  return (
    <AuthPanel
      gate={{ next, reason: next !== "/" ? "Sign in to continue to that page" : undefined }}
      onDone={() => router.prefetch(next)}
      googleEnabled={googleEnabled}
      initialError={initialError}
    />
  );
}
