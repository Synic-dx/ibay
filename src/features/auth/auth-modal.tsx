"use client";
/**
 * FEATURE: Blurred-backdrop auth modal for guests [RUBRIC:AUTH]
 * WHAT: Opens when a guest taps a product, Save, Sell, Chats, You, Requests,
 *       Claim or Bid. Shows the tapped product, why sign-in is needed, the
 *       CAPTCHA, Google and the email code form. After sign-in it resumes the
 *       action (navigates to `next`). Also shows first-login onboarding for
 *       people who came in through Google.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useApp } from "@/components/app-context";
import { AuthPanel, Onboarding } from "./auth-panel";

export function AuthModal() {
  const { auth, closeAuth, flags, viewer } = useApp();
  const router = useRouter();
  const [skipOnboard, setSkipOnboard] = useState(false);
  const needsOnboarding = Boolean(viewer && !viewer.onboarded && !skipOnboard);
  const open = Boolean(auth && !viewer) || needsOnboarding;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && (needsOnboarding ? setSkipOnboard(true) : closeAuth())}>
      <Dialog.Portal>
        <Dialog.Overlay className="blurwrap" />
        <div className="blurwrap" style={{ background: "transparent", backdropFilter: "none", pointerEvents: "none" }}>
          <Dialog.Content className="authcard" aria-labelledby="authT" style={{ pointerEvents: "auto" }}>
            <Dialog.Description className="vh">Sign in with your IIM Indore account</Dialog.Description>
            <Dialog.Close className="x" aria-label="Close">
              <Icon name="x" />
            </Dialog.Close>
            {needsOnboarding ? (
              <Onboarding
                onFinish={() => {
                  setSkipOnboard(true);
                  router.refresh();
                }}
              />
            ) : (
              auth && <AuthPanel gate={auth} onDone={closeAuth} googleEnabled={flags.google} />
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
