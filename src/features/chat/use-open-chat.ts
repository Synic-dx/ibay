"use client";
/**
 * FEATURE: "Chat with seller" from anywhere
 * WHAT: Opens (or creates) the thread. On desktop it pops up in the
 *       messaging dock with instant optimistic feedback; on phones it
 *       navigates to the full-screen chat.
 */
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { openChat } from "./actions";
import type { Thread } from "./queries";

export const OPEN_CHAT_EVENT = "ibay:open-chat";

export type OpenChatMeta = {
  other?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarColor?: string;
    plume?: number;
    ratedDeals?: number;
    hostel?: string;
  };
  listing?: {
    id: string;
    title: string;
    price: number;
    photoUrl?: string | null;
  };
};

export type OpenChatDetail = {
  id: string | null;
  thread?: Thread | null;
  other?: OpenChatMeta["other"];
  listing?: OpenChatMeta["listing"];
};

export function useOpenChat() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { viewer, openAuth } = useApp();
  const [pending, start] = useTransition();

  const open = useCallback(
    (otherId: string, listingId?: string | null, prefill?: string, meta?: OpenChatMeta) => {
      if (!viewer) return openAuth({ reason: "Sign in to chat with sellers" });

      // Optimistic dock open on desktop: show window immediately in loading/skeleton state
      if (typeof window !== "undefined" && window.innerWidth >= 1080) {
        window.dispatchEvent(
          new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, {
            detail: { id: "pending", other: meta?.other, listing: meta?.listing },
          })
        );
      }

      start(async () => {
        const r = await openChat(otherId, listingId, prefill);
        if (!r.ok) {
          if (typeof window !== "undefined" && window.innerWidth >= 1080) {
            window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail: { id: null } }));
          }
          return void toast.error(r.formError);
        }

        // Prime the TanStack Query cache directly with the thread returned by openChat
        if (r.data.thread) {
          queryClient.setQueryData(["thread", r.data.id], r.data.thread);
        }

        if (typeof window !== "undefined" && window.innerWidth >= 1080) {
          window.dispatchEvent(
            new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, {
              detail: { id: r.data.id, thread: r.data.thread, other: meta?.other, listing: meta?.listing },
            })
          );
        } else {
          router.push(`/messages/${r.data.id}`);
        }
      });
    },
    [viewer, openAuth, router, queryClient],
  );

  return { open, pending };
}
