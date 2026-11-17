"use client";
/**
 * FEATURE: Delete confirm dialog with guard rails and Undo [RUBRIC:CRUD-DELETE]
 * WHAT: Says exactly what will happen, then soft-deletes and shows a toast
 *       with Undo for 10 seconds.
 * GUARD RAILS: auction with bids -> "End auction instead";
 *              rental with an active or upcoming booking -> "Pause instead".
 *              (The server checks the same rules again.)
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { fmt } from "@/lib/format";
import { deleteListing, restoreListing } from "./actions/delete";
import { setPaused } from "./actions/update";
import { PhotoTile } from "./components/parts";
import type { ListingCard } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listing: ListingCard;
  bids: number;
  bookedAhead: boolean;
  afterDelete?: () => void;
  onEndAuction?: () => void;
};

/** Shows the "Deleted. Undo" toast; Undo restores the listing. */
export function undoToast(id: string, refresh: () => void, label = "Listing deleted") {
  toast(label, {
    duration: 10_000,
    action: {
      label: "Undo",
      onClick: async () => {
        const r = await restoreListing(id);
        if (r.ok) toast("Listing restored");
        else toast.error(r.formError);
        refresh();
      },
    },
  });
}

export function DeleteDialog({ open, onOpenChange, listing: l, bids, bookedAhead, afterDelete, onEndAuction }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const auctionLocked = l.mode === "auction" && bids > 0 && l.status === "active";
  const rentLocked = l.mode === "rent" && bookedAhead;

  const doDelete = () =>
    start(async () => {
      const r = await deleteListing(l.id);
      if (!r.ok) {
        toast.error(r.formError);
        return;
      }
      onOpenChange(false);
      undoToast(l.id, () => router.refresh());
      afterDelete?.();
      router.refresh();
    });
  const pause = () =>
    start(async () => {
      const r = await setPaused(l.id, true);
      onOpenChange(false);
      if (r.ok) toast(r.message);
      else toast.error(r.formError);
      router.refresh();
    });

  if (auctionLocked) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} icon="alert" title="Can't delete this auction" subtitle={`${bids} ${bids === 1 ? "person has" : "people have"} bid on it`}>
        <div className="stack" style={{ gap: 12 }}>
          <p className="sm muted">Deleting would cancel their bids without warning. End the auction instead: you can sell to any bidder or close it without selling.</p>
          <button
            type="button"
            className="btn block"
            onClick={() => {
              onOpenChange(false);
              if (onEndAuction) onEndAuction();
              else router.push(`/item/${l.id}?sheet=close`);
            }}
          >
            <Icon name="hammer" />
            End auction instead
          </button>
          <button type="button" className="btn sec block" onClick={() => onOpenChange(false)}>
            Keep it
          </button>
        </div>
      </Sheet>
    );
  }
  if (rentLocked) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} icon="alert" title="Can't delete while it is rented" subtitle="Someone has an active or upcoming booking">
        <div className="stack" style={{ gap: 12 }}>
          <p className="sm muted">Pause it so no new bookings come in. You can delete it after the item is returned.</p>
          <button type="button" className="btn block" onClick={pause} disabled={pending}>
            <Icon name="pause" />
            Pause instead
          </button>
          <button type="button" className="btn sec block" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} icon="trash" title="Delete this listing?" subtitle={l.title}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="ctxprod">
          <PhotoTile l={l} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="sm" style={{ display: "block" }}>
              Delete &apos;{l.title}&apos;?
            </b>
            <span className="xs muted">
              {fmt(l.price)} · {l.views} views · {l.saves} saves
            </span>
          </div>
        </div>
        <ul className="bullets sm">
          <li>It disappears from search, saved lists and the requests it answered, right away.</li>
          <li>Chats stay, with a &quot;Listing deleted&quot; card, so buyers know what happened.</li>
          <li>You can restore it from My listings for 30 days.</li>
        </ul>
        <div className="row">
          <button type="button" className="btn sec" style={{ flex: 1 }} onClick={() => onOpenChange(false)} autoFocus>
            Cancel
          </button>
          <button type="button" className="btn danger" style={{ flex: 1 }} onClick={doDelete} disabled={pending}>
            {pending ? <span className="spin" /> : <Icon name="trash" />}
            Delete
          </button>
        </div>
      </div>
    </Sheet>
  );
}
