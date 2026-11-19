"use client";

import React, { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { findEquidistantMeetingSpots, formatMeetHalfwayMessage, type HalfwaySpot } from "../midpoint";
import styles from "./map.module.css";

export interface MeetHalfwayPickerProps {
  userHostel: string;
  otherHostel: string;
  onSelectSpot: (message: string) => void;
  onClose: () => void;
}

export default function MeetHalfwayPicker({
  userHostel,
  otherHostel,
  onSelectSpot,
  onClose,
}: MeetHalfwayPickerProps) {
  const spots = useMemo(() => {
    return findEquidistantMeetingSpots(userHostel, otherHostel, 3);
  }, [userHostel, otherHostel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--card-bg, #ffffff)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.22)",
          border: "1px solid var(--line, #e2e8f0)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-raised, #f8fafc)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--ink, #0f172a)", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="compass" className="icon i16" />
              Meet Halfway
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
              Fair neutral spots between {userHostel} & {otherHostel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-2)",
            }}
            aria-label="Close"
          >
            <Icon name="x" className="icon i14" />
          </button>
        </div>

        {/* Spot options */}
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {spots.map((spot, idx) => {
            const msg = formatMeetHalfwayMessage(spot, userHostel, otherHostel);
            const isTop = idx === 0;

            return (
              <div
                key={spot.location.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: isTop ? "2px solid var(--brand, #02505f)" : "1px solid var(--line, #e2e8f0)",
                  background: isTop ? "var(--brand-soft)" : "var(--card-bg, #ffffff)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <b style={{ fontSize: "14px", color: "var(--ink, #0f172a)" }}>
                      {spot.location.name}
                    </b>
                    {isTop && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--brand)",
                          color: "var(--on-brand)",
                        }}
                      >
                        Closest Midpoint
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", marginTop: "2px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="compass" className="icon i14" />
                    <span>{spot.distA}m from you · {spot.distB}m from them</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSpot(msg);
                    onClose();
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "var(--brand, #02505f)",
                    color: "var(--on-brand, #ffffff)",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Suggest →
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
