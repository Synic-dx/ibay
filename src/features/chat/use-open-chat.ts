"use client";
/**
 * FEATURE: "Chat with seller" from anywhere
 * WHAT: Opens (or creates) the thread. On desktop it pops up in the
 *       messaging dock; on phones it opens the full-screen chat.
 */
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { openChat } from "./actions";

export const OPEN_CHAT_EVENT = "ibay:open-chat";

export function useOpenChat() {
  const router = useRouter();
  const { viewer, openAuth } = useApp();
  const [pending, start] = useTransition();
  const open = useCallback(
    (otherId: string, listingId?: string | null, prefill?: string) => {
      if (!viewer) return openAuth({ reason: "Sign in to chat with sellers" });
      start(async () => {
        const r = await openChat(otherId, listingId, prefill);
        if (!r.ok) return void toast.error(r.formError);
        if (window.innerWidth >= 1080) window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { id: r.data.id } }));
        else router.push(`/messages/${r.data.id}`);
      });
    },
    [viewer, openAuth, router],
  );
  return { open, pending };
}
