"use client";

import React, { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { triggerHaptic } from "@/lib/haptics";
import { getHandoverOtp, regenerateHandoverOtp } from "../actions";

interface HandoverOtpDisplayProps {
  txId: string;
  code?: string | null;
  step: "pickup" | "return";
  sellerName: string;
  compact?: boolean;
}

export default function HandoverOtpDisplay({
  txId,
  code: initialCode,
  step = "pickup",
  sellerName = "Seller",
  compact = false,
}: HandoverOtpDisplayProps) {
  const [currentCode, setCurrentCode] = useState<string | null>(initialCode ?? null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Sync state if initialCode prop updates
  useEffect(() => {
    if (initialCode) {
      setCurrentCode(initialCode);
    }
  }, [initialCode]);

  // Auto-generate/retrieve OTP immediately if missing on mount
  useEffect(() => {
    if (!currentCode && txId) {
      let active = true;
      startTransition(async () => {
        const res = await getHandoverOtp(txId, step);
        if (active && res.ok && res.data.code) {
          setCurrentCode(res.data.code);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [currentCode, txId, step]);

  const isReturn = step === "return";
  const title = isReturn ? "Rental Return Code" : "Delivery Pickup Code";
  const instructions = isReturn
    ? `Share this code with ${sellerName} once you've returned the item and checked its condition together.`
    : `Share this code with ${sellerName} after inspecting the item and completing payment.`;

  const handleCopy = () => {
    if (!currentCode) return;
    triggerHaptic("medium");
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast.success("Verification code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    startTransition(async () => {
      const res = await regenerateHandoverOtp(txId, step);
      if (res.ok) {
        setCurrentCode(res.data.code);
        toast.success(res.message || "New code generated");
      } else {
        toast.error(res.formError || "Could not regenerate code");
      }
    });
  };

  // Format code into 2 chunks of 3 digits
  const rawCode = currentCode || "------";
  const firstChunk = rawCode.slice(0, 3).split("");
  const secondChunk = rawCode.slice(3, 6).split("");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
        padding: compact ? "10px 12px" : "14px 16px",
        borderRadius: 12,
        background: "var(--tint, rgba(2, 80, 95, 0.05))",
        border: "1px solid var(--brand, #02505F)",
        position: "relative",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--brand, #02505F)", display: "flex", alignItems: "center" }}>
            <Icon name="shield" className="icon i16" />
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand, #02505F)" }}>
            {title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            aria-label="Copy verification code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: 6,
              background: copied ? "var(--brand, #02505F)" : "var(--surface, #ffffff)",
              color: copied ? "var(--on-brand, #ffffff)" : "var(--ink, #0f172a)",
              border: "1px solid var(--shr, rgba(0,0,0,0.1))",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Icon name={copied ? "check" : "layers"} className="icon i12" />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={pending}
            title="Regenerate code"
            aria-label="Regenerate verification code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 6px",
              borderRadius: 6,
              background: "transparent",
              color: "var(--muted, #64748b)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {pending ? <span className="spin" /> : <Icon name="repeat" className="icon i14" />}
          </button>
        </div>
      </div>

      {/* Segmented OTP Digits */}
      <div
        role="region"
        aria-label={`Verification code: ${rawCode}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 0",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {firstChunk.map((digit, i) => (
            <span
              key={`c1-${i}`}
              style={{
                width: compact ? 28 : 34,
                height: compact ? 34 : 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: compact ? 18 : 22,
                fontWeight: 700,
                color: "var(--brand, #02505F)",
                background: "var(--surface, #ffffff)",
                border: "1px solid rgba(2, 80, 95, 0.2)",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.5px",
              }}
            >
              {digit}
            </span>
          ))}
        </div>

        <span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 700, padding: "0 2px" }}>
          ·
        </span>

        <div style={{ display: "flex", gap: 4 }}>
          {secondChunk.map((digit, i) => (
            <span
              key={`c2-${i}`}
              style={{
                width: compact ? 28 : 34,
                height: compact ? 34 : 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: compact ? 18 : 22,
                fontWeight: 700,
                color: "var(--brand, #02505F)",
                background: "var(--surface, #ffffff)",
                border: "1px solid rgba(2, 80, 95, 0.2)",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.5px",
              }}
            >
              {digit}
            </span>
          ))}
        </div>
      </div>

      {/* Helper text */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--ink)", lineHeight: 1.4 }}>
          {instructions}
        </span>
      </div>
    </div>
  );
}
