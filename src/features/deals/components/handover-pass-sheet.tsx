"use client";

import React from "react";
import Link from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { fmt } from "@/lib/format";
import HandoverOtpDisplay from "./handover-otp-display";
import HandoverStatusBadge from "./handover-status-badge";

export interface HandoverPassSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: {
    id: string;
    amount: number;
    isBuyer?: boolean;
    stage?: number;
    status?: string;
    handoverScheduledAt?: string | null;
    handoverStatus?: "proposed" | "confirmed" | "rescheduled" | "completed";
    handoverProposedBy?: string | null;
    deliveryOtp?: string | null;
    returnOtp?: string | null;
  };
  other: {
    id?: string;
    name: string;
    avatarUrl?: string | null;
  };
  listing?: {
    id?: string;
    title: string;
    pickupHostel?: string;
    pickupSlots?: string[];
  } | null;
  viewerId?: string;
}

export default function HandoverPassSheet({
  open,
  onOpenChange,
  deal,
  other,
  listing,
  viewerId,
}: HandoverPassSheetProps) {
  const isBuyer = Boolean(deal.isBuyer);
  const firstName = other.name.split(" ")[0];
  const title = isBuyer ? "Delivery Pickup Pass" : "Deal Verification & Handover";
  const step = deal.stage === 1 ? "return" : "pickup";
  const activeOtp = deal.stage === 1 ? deal.returnOtp : deal.deliveryOtp;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon="shield"
      subtitle={`${listing?.title ? `${listing.title} · ` : ""}Agreed ${fmt(deal.amount)} with ${firstName}`}
      tall
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
        {/* Deal Summary Card */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--surface-2, #f5f6f8)",
            border: "1px solid var(--line, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: "var(--ink-2, #6b7280)", fontSize: 12, display: "block" }}>Item &amp; Partner</span>
            <b>{listing?.title ?? "Item"}</b> · {firstName}
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "var(--ink-2, #6b7280)", fontSize: 12, display: "block" }}>Amount</span>
            <b style={{ color: "var(--brand, #02505F)", fontSize: 15 }}>{fmt(deal.amount)}</b>
          </div>
        </div>

        {/* Handover Meeting Schedule */}
        {deal.handoverScheduledAt && (
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-2, #6b7280)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Meeting Logistics
            </span>
            <HandoverStatusBadge
              txId={deal.id}
              scheduledAt={deal.handoverScheduledAt}
              status={deal.handoverStatus}
              proposedBy={deal.handoverProposedBy}
              currentUserId={viewerId}
              otherName={firstName}
              listingTitle={listing?.title ?? "Item"}
              locationName={listing?.pickupHostel ?? "Campus"}
              sellerSlots={listing?.pickupSlots}
              compact={false}
            />
          </div>
        )}

        {/* Role-Specific Code / Verification View */}
        {isBuyer ? (
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-2, #6b7280)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Verification Credential
            </span>
            <HandoverOtpDisplay
              txId={deal.id}
              code={activeOtp}
              step={step}
              sellerName={firstName}
              compact={false}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "16px",
              borderRadius: 12,
              border: "1px solid var(--brand, #02505F)",
              background: "var(--tint, rgba(2, 80, 95, 0.05))",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--brand, #02505F)" }}>
              <Icon name="shield" className="icon i18" />
              <b style={{ fontSize: 14 }}>Seller Code Entry</b>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--ink, #1f2937)" }}>
              Ask {firstName} for their 6-digit delivery code when you meet. After inspecting the item and receiving payment, enter the code on the Deals page to confirm handover and release funds.
            </p>
            <a
              href="/deals"
              className="btn block"
              style={{ marginTop: 4, textAlign: "center" }}
              onClick={() => onOpenChange(false)}
            >
              <Icon name="check" />
              Enter Delivery Code on Deals Page
            </a>
          </div>
        )}

        {/* Deep-link to Deals Hub */}
        <div style={{ paddingTop: 8, borderTop: "1px solid var(--line, #e5e7eb)" }}>
          <a
            href="/deals"
            className="btn sec block"
            style={{ textAlign: "center" }}
            onClick={() => onOpenChange(false)}
          >
            Open Full Deal Tracking
          </a>
        </div>
      </div>
    </Sheet>
  );
}
