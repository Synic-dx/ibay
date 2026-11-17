"use client";
/** "Message" on a profile (opens the chat; guests get the sign-in modal). */
import { Icon } from "@/components/ui/icon";
import { useOpenChat } from "@/features/chat/use-open-chat";

export function MessageButton({ userId }: { userId: string }) {
  const { open, pending } = useOpenChat();
  return (
    <button type="button" className="btn block" style={{ marginTop: 6 }} onClick={() => open(userId)} disabled={pending}>
      <Icon name="chat" />
      Message
    </button>
  );
}
