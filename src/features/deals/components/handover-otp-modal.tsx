"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { fmt } from "@/lib/format";
import { PhotoTile } from "@/features/listings/components/parts";
import type { Deal } from "../stages";
import { verifyHandoverOtp } from "../actions";
import OtpPinInput from "./otp-pin-input";

interface HandoverOtpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  step: "pickup" | "return";
  onSuccess?: () => void;
}

export default function HandoverOtpModal({
  open,
  onOpenChange,
  deal,
  step = "pickup",
  onSuccess,
}: HandoverOtpModalProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isReturn = step === "return";
  const first = deal.other.name.split(" ")[0];
  const title = isReturn ? "Verify Return Code" : "Verify Delivery Code";
  const subtitle = `Ask ${first} for the 6-digit code displayed on their phone.`;

  const submitOtp = (candidateCode: string) => {
    if (candidateCode.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await verifyHandoverOtp(deal.id, candidateCode, step);
      if (res.ok) {
        toast.success(res.message || (isReturn ? "Return verified" : "Handover confirmed"));
        onOpenChange(false);
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        setError(res.formError || "Invalid code. Please check with buyer.");
        toast.error(res.formError || "Verification failed");
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      icon="shield"
      title={title}
      subtitle={subtitle}
    >
      <div className="stack" style={{ gap: 14 }}>
        {/* Deal Context Strip */}
        <div className="ctxprod">
          <PhotoTile l={deal.listing} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="sm" style={{ display: "block" }}>
              {deal.listing.title}
            </b>
            <div className="faint xs">
              {isReturn
                ? `Return from ${first}: check it came back in the same condition`
                : `Payment: ${fmt(deal.amount)} from ${first}`}
            </div>
          </div>
        </div>

        {/* Verification Check Reminder */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--bg-raised, #f8fafc)",
            border: "1px solid var(--shr, rgba(0,0,0,0.08))",
            fontSize: 12,
            color: "var(--ink)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--brand, #02505F)", marginTop: 1 }}>
            <Icon name="check" className="icon i14" />
          </span>
          <span style={{ lineHeight: 1.4 }}>
            {isReturn
              ? `Check the returned item's condition together before entering the code.`
              : `Inspect payment (${fmt(deal.amount)}) and hand over the item together before entering the code.`}
          </span>
        </div>

        {/* 6-Digit PIN Input */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <OtpPinInput
            value={pin}
            onChange={(val) => {
              setPin(val);
              if (error) setError(null);
            }}
            onComplete={(val) => submitOtp(val)}
            hasError={Boolean(error)}
            disabled={pending}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            role="alert"
          >
            <Icon name="alert" className="icon i14" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          className="btn block"
          onClick={() => submitOtp(pin)}
          disabled={pending || pin.length !== 6}
          style={{ marginTop: 4 }}
        >
          {pending ? <span className="spin" /> : <Icon name="check" className="icon i16" />}
          {isReturn ? "Confirm Return" : "Confirm Handover"}
        </button>
      </div>
    </Sheet>
  );
}
