"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ListingCard } from "@/features/listings/types";
import { fmt } from "@/lib/format";
import styles from "./map.module.css";

export interface MapDrawerProps {
  hostelName: string | null;
  listings: ListingCard[];
  onClose: () => void;
}

export default function MapDrawer({ hostelName, listings, onClose }: MapDrawerProps) {
  if (!hostelName) return null;

  const hostelListings = listings.filter(
    (l) => l.pickupHostel.toLowerCase() === hostelName.toLowerCase()
  );

  const drops = hostelListings.filter((l) => l.mode === "drop");
  const regularListings = hostelListings.filter((l) => l.mode !== "drop");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "75vh",
        background: "var(--card-bg, #ffffff)",
        borderTop: "2px solid var(--brand, #02505f)",
        borderTopLeftRadius: "18px",
        borderTopRightRadius: "18px",
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.18)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Drawer Handle & Header */}
      <div
        style={{
          padding: "14px 18px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--line, #e2e8f0)",
          background: "var(--bg-raised, #f8fafc)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--brand, #02505F)", display: "flex", alignItems: "center" }}>
            <Icon name="home" className="icon i18" />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
              {hostelName}
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
              {hostelListings.length} {hostelListings.length === 1 ? "item" : "items"} available here
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "1px solid var(--line, #cbd5e1)",
            background: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink, #334155)",
          }}
          aria-label="Close drawer"
        >
          <Icon name="x" className="icon i16" />
        </button>
      </div>

      {/* Content List */}
      <div
        style={{
          padding: "14px 18px 24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Active Food Drop Alert */}
        {drops.map((drop) => (
          <Link
            key={drop.id}
            href={`/item/${drop.id}`}
            style={{
              padding: "12px",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#e11d48", display: "flex", alignItems: "center" }}>
                <Icon name="flame" className="icon i20" />
              </span>
              <div>
                <b style={{ color: "#9f1239", fontSize: "14px", display: "block" }}>
                  Food Drop: {drop.title}
                </b>
                <span style={{ color: "#e11d48", fontSize: "12px" }}>
                  {drop.price === 0 ? "Free food" : `₹${drop.price}`} · Claim before it cools
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                background: "#e11d48",
                padding: "6px 12px",
                borderRadius: "6px",
              }}
            >
              Claim
            </span>
          </Link>
        ))}

        {/* Regular Items */}
        {regularListings.length === 0 && drops.length === 0 ? (
          <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            <span style={{ color: "var(--muted)", display: "flex", justifyContent: "center" }}>
              <Icon name="pkg" className="icon i24" />
            </span>
            <p style={{ marginTop: "6px", fontSize: "14px" }}>
              No active listings in {hostelName} right now.
            </p>
          </div>
        ) : (
          regularListings.map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "#ffffff",
                textDecoration: "none",
                color: "inherit",
                transition: "transform 0.1s ease",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "8px",
                  background: "var(--bg-raised, #f1f5f9)",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photo.url}
                    alt={item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "var(--muted)", display: "flex" }}>
                    <Icon name="pkg" className="icon i18" />
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b
                  style={{
                    fontSize: "13px",
                    color: "var(--ink, #0f172a)",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </b>
                <span style={{ fontSize: "12px", color: "var(--brand, #02505f)", fontWeight: 700 }}>
                  {fmt(item.price)}
                  {item.mode === "rent" ? ` / ${item.rentUnit}` : ""}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", marginLeft: "8px" }}>
                  by {item.seller.name.split(" ")[0]} (Plume {Math.round(item.seller.plume)})
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
