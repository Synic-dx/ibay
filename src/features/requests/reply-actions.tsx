"use client";
/**
 * FEATURE: Reply buttons on a request
 * WHAT: Owner: Accept / Message. Replier: Edit / Delete their own offer.
 *       ReplyBar: the "Have one? I have this" bar for everyone else.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useOpenChat } from "@/features/chat/use-open-chat";
import { acceptReply, deleteReply, updateReply } from "./actions";
import { ReplySheet } from "./request-ui";

export function ReplyActions({ replyId, mineReply, mineRequest, authorId, text, priceText, requestText }: { replyId: string; mineReply: boolean; mineRequest: boolean; authorId: string; text: string; priceText: string; requestText: string }) {
  const router = useRouter();
  const { open } = useOpenChat();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [t, setT] = useState(text);
  const [p, setP] = useState(priceText);
  if (mineReply) {
    return (
      <>
        <span className="row">
          <span className="faint xs">Your offer</span>
          <button type="button" className="btn quiet small" onClick={() => setEdit(true)}>
            <Icon name="edit" />
            Edit
          </button>
          <button
            type="button"
            className="btn quiet small danger-o"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteReply(replyId);
                if (r.ok) toast(r.message);
                router.refresh();
              })
            }
          >
            <Icon name="trash" />
            Delete
          </button>
        </span>
        <Sheet open={edit} onOpenChange={setEdit} icon="edit" title="Edit your offer">
          <div className="stack" style={{ gap: 12 }}>
            <textarea className="input" value={t} onChange={(e) => setT(e.target.value)} aria-label="Description" maxLength={500} />
            <input className="input" value={p} onChange={(e) => setP(e.target.value)} aria-label="Price" maxLength={40} />
            <button
              type="button"
              className="btn block"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateReply(replyId, { text: t, priceText: p });
                  if (!r.ok) return void toast.error(r.fieldErrors?.text ?? r.formError);
                  toast(r.message);
                  setEdit(false);
                  router.refresh();
                })
              }
            >
              Save
            </button>
          </div>
        </Sheet>
      </>
    );
  }
  return (
    <span className="row">
      {mineRequest && (
        <button
          type="button"
          className="btn small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptReply(replyId);
              if (!r.ok) return void toast.error(r.formError);
              toast(r.message);
              if (r.data.conversationId) router.push(`/messages/${r.data.conversationId}`);
            })
          }
        >
          <Icon name="check" />
          Accept
        </button>
      )}
      <button type="button" className="btn sec small" onClick={() => open(authorId, null, `Hi! About your offer for: ${requestText}`)}>
        <Icon name="chat" />
        Message
      </button>
    </span>
  );
}

export function ReplyBar({ requestId, requestText }: { requestId: string; requestText: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="actbar">
        <div className="pr">
          <b>Have one?</b>
          <span>Reply with a photo and price</span>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          <Icon name="img" />I have this
        </button>
      </div>
      <ReplySheet open={open} onOpenChange={setOpen} requestId={requestId} requestText={requestText} />
    </>
  );
}
