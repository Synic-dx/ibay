"use client";

import React from "react";
import { Icon } from "@/components/ui/icon";
import { fmt } from "@/lib/format";
import { formatHandoverSchedule } from "@/features/deals/scheduling";

export interface ChatDealBarProps {
  deal: {
    id: string;
    amount: number;
    isBuyer?: boolean;
    stage?: number;
    handoverScheduledAt?: string | null;
    handoverStatus?: "proposed" | "confirmed" | "rescheduled" | "completed";
  };
  compact?: boolean;
  onOpenPass?: () => void;
}

export function ChatDealBar({ deal, compact = false, onOpenPass }: ChatDealBarProps) {
  const isScheduled = Boolean(deal.handoverScheduledAt);
  const scheduledText = isScheduled
    ? `Handover ${formatHandoverSchedule(deal.handoverScheduledAt)}`
    : `Deal agreed · ${fmt(deal.amount)}`;

  const actionLabel = deal.isBuyer ? "View Pass" : "Verify Deal";

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
            flexShrink: 0,
          }}
        >
          {actionLabel}
          <Icon name="chev" className="icon i14" style={{ transform: "rotate(-90deg)" }} />
        </button>
      )}
    </div>
  );
}
