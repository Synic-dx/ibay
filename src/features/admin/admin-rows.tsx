"use client";
/**
 * FEATURE: Admin row buttons for the Listings and Users tabs
 * WHAT: Listings: edit, hide / unhide, delete / restore.
 *       Users: ban / unban, delete account (asks first, says exactly what goes).
 * The server actions check the admin role again; these buttons are only shown to admins.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "@/components/ui/link";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { adminDeleteListing, adminDeleteUser, adminRestoreListing, setBanned, setListingHidden } from "./actions";

type Result = { ok: boolean; message?: string; formError?: string };

/** Runs a server action, shows the result as a toast and refreshes the table. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(r.message);
        after?.();
      } else toast.error(r.formError ?? "That didn't work. Try again.");
      router.refresh();
    });
  return { pending, run };
}

export function ListingRowActions({ id, title, status }: { id: string; title: string; status: string }) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState(false);
  const deleted = status === "deleted";
  const hidden = status === "hidden";
  const editable = status === "active" || status === "paused";
  return (
    <span className="ract" style={{ flexWrap: "wrap", gap: 4 }}>
      {editable && (
        <Link className="btn sec small" href={`/listings/${id}/edit`} aria-label={`Edit ${title}`}>
          <Icon name="edit" />
          Edit
        </Link>
      )}
      {!deleted && (status === "active" || hidden) && (
        <button type="button" className="btn sec small" disabled={pending} onClick={() => run(() => setListingHidden(id, !hidden))}>
          <Icon name={hidden ? "eye" : "x"} />
          {hidden ? "Unhide" : "Hide"}
        </button>
      )}
      {deleted ? (
        <button type="button" className="btn sec small" disabled={pending} onClick={() => run(() => adminRestoreListing(id))}>
          <Icon name="undo" />
          Restore
        </button>
      ) : (
        <button type="button" className="btn sec small danger-o" disabled={pending} onClick={() => setConfirm(true)}>
          <Icon name="trash" />
          Delete
        </button>
      )}
      <Sheet open={confirm} onOpenChange={setConfirm} icon="trash" title="Delete this listing?" subtitle={title}>
        <div className="stack" style={{ gap: 12 }}>
          <p className="sm muted">It disappears from i-bay straight away, including auctions with bids and rentals with bookings. You can restore it later from the Deleted filter.</p>
          <button type="button" className="btn block danger" disabled={pending} onClick={() => run(() => adminDeleteListing(id), () => setConfirm(false))}>
            {pending ? <span className="spin" /> : <Icon name="trash" />}
            Delete listing
          </button>
          <button type="button" className="btn quiet block" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </span>
  );
}

export function UserRowActions({ id, name, banned, isAdmin, listings }: { id: string; name: string; banned: boolean; isAdmin: boolean; listings: number }) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  // WHY: admin accounts are protected; remove the admin role in the database first if really needed.
  if (isAdmin) return <span className="xs faint">Admin account</span>;
  return (
    <span className="ract" style={{ flexWrap: "wrap", gap: 4 }}>
      <button type="button" className="btn sec small" disabled={pending} onClick={() => run(() => setBanned(id, !banned))}>
        <Icon name="flag" />
        {banned ? "Unban" : "Ban"}
      </button>
      <button type="button" className="btn sec small danger-o" disabled={pending} onClick={() => (setTyped(""), setConfirm(true))}>
        <Icon name="trash" />
        Delete
      </button>
      <Sheet open={confirm} onOpenChange={setConfirm} icon="trash" title={`Delete ${name}'s account?`} subtitle="This can't be undone.">
        <div className="stack" style={{ gap: 12 }}>
          <p className="sm muted">
            This permanently removes the account and its {listings} listing{listings === 1 ? "" : "s"}, bids, deals, chats and saved items. Auctions they bid on go back to the next highest bid.
            To stop someone without deleting anything, use <b>Ban</b> instead.
          </p>
          <label className="stack" style={{ gap: 6 }}>
            <span className="sm">
              Type <b>DELETE</b> to confirm
            </span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label="Type DELETE to confirm" />
          </label>
          <button
            type="button"
            className="btn block danger"
            disabled={pending || typed !== "DELETE"}
            onClick={() => run(() => adminDeleteUser(id), () => setConfirm(false))}
          >
            {pending ? <span className="spin" /> : <Icon name="trash" />}
            Delete account
          </button>
          <button type="button" className="btn quiet block" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </span>
  );
}
