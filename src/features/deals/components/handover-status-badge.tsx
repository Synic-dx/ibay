"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { formatHandoverSchedule, createGoogleCalendarUrl } from "../scheduling";
import { confirmHandoverTime, rescheduleHandoverTime } from "../actions";
import HandoverTimePicker from "./handover-time-picker";

interface HandoverStatusBadgeProps {
  txId: string;
  scheduledAt?: string | null;
  status?: "proposed" | "confirmed" | "rescheduled" | "completed";
  proposedBy?: string | null;
  currentUserId?: string;
  otherName?: string;
  listingTitle?: string;
  locationName?: string;
  sellerSlots?: string[];
  compact?: boolean;
}

export default function HandoverStatusBadge({
  txId,
  scheduledAt,
  status = "proposed",
  proposedBy,
  currentUserId,
  otherName = "Partner",
  listingTitle = "Item",
  locationName = "Campus",
  sellerSlots = [],
  compact = false,
}: HandoverStatusBadgeProps) {
  const router = useRouter();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newIso, setNewIso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!scheduledAt) return null;

  const formattedTime = formatHandoverSchedule(scheduledAt);
  const isMine = currentUserId && proposedBy === currentUserId;
  const isConfirmed = status === "confirmed";

  const handleAccept = () => {
    startTransition(async () => {
      const res = await confirmHandoverTime(txId);
      if (res.ok) {
        toast.success("Handover meeting time confirmed");
        router.refresh();
      } else {
        toast.error(res.formError || "Could not confirm time");
      }
    });
  };

  const handleRescheduleSubmit = () => {
    if (!newIso) {
      setIsRescheduling(false);
      return;
    }
    startTransition(async () => {
      const res = await rescheduleHandoverTime(txId, newIso);
      if (res.ok) {
        toast.success("New handover time proposed");
        setIsRescheduling(false);
        router.refresh();
      } else {
        toast.error(res.formError || "Could not update time");
      }
    });
  };

  const calendarUrl = createGoogleCalendarUrl({
    title: `Handover: ${listingTitle}`,
    location: locationName,
    startIso: scheduledAt,
    details: `Handover meeting for ${listingTitle} with ${otherName}. Coordinated via i-bay.`,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: compact ? "8px 12px" : "12px 14px",
        borderRadius: 10,
        background: isConfirmed ? "rgba(2, 80, 95, 0.05)" : "var(--bg-raised, #f8fafc)",
        border: isConfirmed ? "1px solid var(--brand, #02505F)" : "1px solid var(--shr, rgba(0,0,0,0.1))",
        fontSize: 12,
        color: "var(--ink)",
        marginTop: 4,
      }}
    >
      {/* Top Status Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: isConfirmed ? "var(--brand, #02505F)" : "var(--muted)" }}>
            <Icon name={isConfirmed ? "check" : "clock"} className="icon i16" strokeWidth={2.4} />
          </span>
          <span style={{ fontWeight: 600, color: isConfirmed ? "var(--brand, #02505F)" : "var(--ink)" }}>
            {isConfirmed
              ? "Handover time confirmed"
              : isMine
              ? `Waiting for ${otherName}'s confirmation`
              : `${otherName} proposed a meeting`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isConfirmed && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--brand, #02505F)",
                textDecoration: "none",
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(2, 80, 95, 0.08)",
              }}
            >
              <Icon name="cal" className="icon i14" />
              Add to Calendar
            </a>
          )}

          {!isRescheduling && (
            <button
              type="button"
              onClick={() => setIsRescheduling(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                padding: "2px 6px",
              }}
            >
              {isConfirmed ? "Reschedule" : isMine ? "Change" : "Propose other"}
            </button>
          )}
        </div>
      </div>

      {/* Date & Time display */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 22 }}>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
          {formattedTime}
        </span>
      </div>

      {/* Action buttons if not confirmed and pending acceptance by current user */}
      {!isConfirmed && !isMine && !isRescheduling && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, paddingLeft: 22 }}>
          <button
            type="button"
            className="btn small"
            onClick={handleAccept}
            disabled={pending}
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {pending ? <span className="spin" /> : <Icon name="check" className="icon i14" />}
            Accept Time
          </button>
          <button
            type="button"
            className="btn sec small"
            onClick={() => setIsRescheduling(true)}
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Propose Another Time
          </button>
        </div>
      )}

      {/* Inline Rescheduling Picker */}
      {isRescheduling && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 10,
            borderTop: "1px solid var(--shr, rgba(0,0,0,0.08))",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
            Select your preferred meeting date & time:
          </span>
          <HandoverTimePicker
            sellerSlots={sellerSlots}
            initialIso={scheduledAt}
            onChange={setNewIso}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              className="btn sec small"
              onClick={() => setIsRescheduling(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn small"
              onClick={handleRescheduleSubmit}
              disabled={pending}
            >
              {pending ? <span className="spin" /> : <Icon name="check" className="icon i14" />}
              Send Proposed Time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
