"use client";
/**
 * FEATURE: Report a listing, a message or a person [RUBRIC:CAPTCHA]
 * WHAT: Pick a reason, add details, pass the CAPTCHA, send.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useApp } from "@/components/app-context";
import { Captcha } from "@/features/captcha/captcha";
import { REPORT_REASONS } from "@/lib/validation/market";
import { report } from "./actions";

export function ReportButton({ listingId, userId, label = "Report", compact = false }: { listingId?: string; userId?: string; label?: string; compact?: boolean }) {
  const { viewer, openAuth } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      if (!reason) return setErrs({ reason: "Pick a reason." });
      const r = await report({ listingId, userId, reason: reason as never, details, captchaToken: token ?? undefined });
      if (!r.ok) return setErrs(r.fieldErrors ?? { form: r.formError ?? "" });
      toast(r.message);
      setOpen(false);
      setReason("");
      setDetails("");
    });
  return (
    <>
      <button
        type="button"
        className={compact ? "ib" : "btn quiet small"}
        aria-label={label}
        title={label}
        onClick={() => (viewer ? setOpen(true) : openAuth({ reason: "Sign in to report" }))}
      >
        <Icon name="flag" />
        {compact ? null : label}
      </button>
      <Sheet open={open} onOpenChange={setOpen} icon="flag" title={label} subtitle="Reports go to the i-bay team. The person is not told who reported.">
        <div className="stack" style={{ gap: 14 }}>
          <div className="lgroup" style={{ boxShadow: "none" }} role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map(([k, n]) => (
              <button key={k} type="button" className="lrow" role="radio" aria-checked={reason === k} onClick={() => (setReason(k), setErrs({}))}>
                <span className="lt">
                  <b>{n}</b>
                </span>
                {reason === k && <Icon name="check" strokeWidth={2.6} />}
              </button>
            ))}
          </div>
          {errs.reason && <span className="ferr" role="alert"><Icon name="alert" className="icon i14" />{errs.reason}</span>}
          <textarea className="input" placeholder="Anything else we should know? (optional)" aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
          <Captcha onVerify={setToken} error={errs.captchaToken} id="report-captcha" />
          {errs.form && <div className="formerr" role="alert">{errs.form}</div>}
          <button type="button" className="btn block" onClick={send} disabled={pending}>
            <Icon name="send" />
            Send report
          </button>
        </div>
      </Sheet>
    </>
  );
}
