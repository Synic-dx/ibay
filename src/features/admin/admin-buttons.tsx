"use client";
/** FEATURE: Admin row buttons (hide listing, ban user, resolve report). */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { resolveReport, setBanned, setListingHidden } from "./actions";

export function AdminButtons({ reportId, listingId, userId, listingHidden, userBanned, status }: { reportId: string; listingId: string | null; userId: string | null; listingHidden: boolean; userBanned: boolean; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; formError?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast(r.message);
      else toast.error(r.formError);
      router.refresh();
    });
  return (
    <span className="ract" style={{ flexWrap: "wrap", gap: 4 }}>
      {listingId && (
        <button type="button" className="btn sec small" disabled={pending} onClick={() => run(() => setListingHidden(listingId, !listingHidden))}>
          <Icon name={listingHidden ? "eye" : "x"} />
          {listingHidden ? "Unhide" : "Hide listing"}
        </button>
      )}
      {userId && (
        <button type="button" className="btn sec small danger-o" disabled={pending} onClick={() => run(() => setBanned(userId, !userBanned))}>
          <Icon name="flag" />
          {userBanned ? "Unban" : "Ban user"}
        </button>
      )}
      {status === "open" && (
        <>
          <button type="button" className="btn small" disabled={pending} onClick={() => run(() => resolveReport(reportId, "actioned"))}>
            <Icon name="check" />
            Done
          </button>
          <button type="button" className="btn quiet small" disabled={pending} onClick={() => run(() => resolveReport(reportId, "dismissed"))}>
            Dismiss
          </button>
        </>
      )}
    </span>
  );
}
