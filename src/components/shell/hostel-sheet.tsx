"use client";
/**
 * FEATURE: "Where should people meet you?" (pickup hostel picker)
 * WHAT: Changing your hostel also changes which food drops you can see.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { HOSTELS } from "@/lib/validation/auth";
import { setHostel } from "@/features/profile/actions";

export function HostelSheet({ open, onOpenChange, current }: { open: boolean; onOpenChange: (v: boolean) => void; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (h: string) =>
    start(async () => {
      const r = await setHostel(h);
      if (!r.ok) return void toast.error(r.formError);
      onOpenChange(false);
      router.refresh();
      toast(`Pickup point set to ${h}`);
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Where should people meet you?" icon="pin" subtitle="Your hostel is your pickup point">
      <div className="lgroup" style={{ boxShadow: "none" }} aria-busy={pending}>
        {HOSTELS.map((h) => (
          <button key={h} type="button" className="lrow" onClick={() => pick(h)} disabled={pending}>
            <span className="li">
              <Icon name="bed" />
            </span>
            <span className="lt">
              <b>{h}</b>
            </span>
            {current === h && <Icon name="check" strokeWidth={2.6} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
