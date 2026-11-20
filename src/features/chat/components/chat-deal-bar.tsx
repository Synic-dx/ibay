"use client";

import React from "react";
import { Icon } from "@/components/ui/icon";
import { fmt } from "@/lib/format";
import { formatHandoverSchedule, createGoogleCalendarUrl } from "@/features/deals/scheduling";

export interface ChatDealBarProps {
  deal: {
    id: string;
    amount: number;
    isBuyer?: boolean;
    stage?: number;
    handoverScheduledAt?: string | null;
    handoverStatus?: "proposed" | "confirmed" | "rescheduled" | "completed";
  };
  listingTitle?: string;
  locationName?: string;
  compact?: boolean;
  onOpenPass?: () => void;
}

export function ChatDealBar({
  deal,
  listingTitle,
  locationName,
  compact = false,
  onOpenPass,
}: ChatDealBarProps) {
  const isScheduled = Boolean(deal.handoverScheduledAt);
  const scheduledText = isScheduled
    ? `Handover ${formatHandoverSchedule(deal.handoverScheduledAt)}`
    : `Deal agreed · ${fmt(deal.amount)}`;

  const actionLabel = deal.isBuyer ? "View Pass" : "Verify Deal";

  const calendarUrl = deal.handoverScheduledAt
    ? createGoogleCalendarUrl({
        title: `Handover: ${listingTitle || "i-bay item"}`,
        location: locationName || "Campus",
        startIso: deal.handoverScheduledAt,
        details: `Campus handover meeting for ${listingTitle || "item"}. Coordinated via i-bay.`,
      })
    : null;

  return (
    <div
      className="dealbar"
      role="region"
      aria-label="Active deal status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 36,
        padding: compact ? "6px 10px" : "8px 14px",
        background: "var(--surface-2, #f5f6f8)",
        borderBottom: "1px solid var(--line, #e5e7eb)",
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        gap: 8,
        cursor: onOpenPass ? "pointer" : "default",
      }}
      onClick={onOpenPass}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "var(--brand, #02505F)",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={isScheduled ? "clock" : "check"} className="icon i16" strokeWidth={2.6} />
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isScheduled ? (
            <>
              <b>{scheduledText}</b>
              <span style={{ opacity: 0.75, marginLeft: 4 }}>· {fmt(deal.amount)}</span>
            </>
          ) : (
            <b>{scheduledText}</b>
          )}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Add to Google Calendar"
            aria-label="Add to Google Calendar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: compact ? 24 : 26,
              height: compact ? 24 : 26,
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--brand, #02505F)",
              border: "1px solid var(--line)",
              textDecoration: "none",
            }}
          >
            <Icon name="cal" className="icon i14" />
          </a>
        )}
        {onOpenPass && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPass();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 6,
              background: "var(--brand, #02505F)",
              color: "#ffffff",
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            {actionLabel}
            <Icon name="chev" className="icon i14" />
          </button>
        )}
      </div>
    </div>
  );
}
