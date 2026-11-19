"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ListingCard } from "@/features/listings/types";
import { fmt } from "@/lib/format";
import { getResidenceCoordinates, calculateDistanceMeters } from "../proximity";

export interface MapDrawerProps {
  hostelName: string | null;
  listings: ListingCard[];
  onClose: () => void;
  viewerHostel?: string | null;
}

type LocalFilter = "all" | "drop" | "sell" | "rent";

export default function MapDrawer({
  hostelName,
  listings,
  onClose,
  viewerHostel,
}: MapDrawerProps) {
  const [filterMode, setFilterMode] = useState<LocalFilter>("all");
  const [localSearch, setLocalSearch] = useState("");

  const hostelListings = useMemo(() => {
    if (!hostelName) return [];
    return listings.filter(
      (l) => l.pickupHostel.toLowerCase() === hostelName.toLowerCase()
    );
  }, [hostelName, listings]);

  const dropsCount = useMemo(() => hostelListings.filter((l) => l.mode === "drop").length, [hostelListings]);
  const sellCount = useMemo(() => hostelListings.filter((l) => l.mode === "sell" || l.mode === "auction").length, [hostelListings]);
  const rentCount = useMemo(() => hostelListings.filter((l) => l.mode === "rent").length, [hostelListings]);

  // Proximity info
  const proximityInfo = useMemo(() => {
    if (!hostelName) return null;
    if (!viewerHostel) return null;
    const isSameHostel = viewerHostel.toLowerCase() === hostelName.toLowerCase();
    if (isSameHostel) {
      return { isSame: true, label: "Your hostel · Immediate pickup" };
    }
    const origin = getResidenceCoordinates(viewerHostel);
    const dest = getResidenceCoordinates(hostelName);
    if (!origin || !dest) return null;
    const meters = calculateDistanceMeters(origin.lat, origin.lng, dest.lat, dest.lng);
    const steps = Math.round(meters / 0.75);
    const walkMins = Math.max(1, Math.round(meters / 80));
    return {
      isSame: false,
      meters,
      steps,
      walkMins,
      label: `~${walkMins} min walk from ${viewerHostel} · ${meters}m (${steps} steps)`,
    };
  }, [hostelName, viewerHostel]);

  // Apply local filters
  const displayedListings = useMemo(() => {
    return hostelListings.filter((l) => {
      if (filterMode === "drop" && l.mode !== "drop") return false;
      if (filterMode === "rent" && l.mode !== "rent") return false;
      if (filterMode === "sell" && l.mode !== "sell" && l.mode !== "auction") return false;

      if (localSearch.trim()) {
        const q = localSearch.toLowerCase().trim();
        const matchesTitle = l.title.toLowerCase().includes(q);
        const matchesCategory = l.categoryId?.toLowerCase().includes(q);
        const matchesSeller = l.seller.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesSeller) return false;
      }
      return true;
    });
  }, [hostelListings, filterMode, localSearch]);

  const activeDrops = useMemo(() => {
    return hostelListings.filter((l) => l.mode === "drop");
  }, [hostelListings]);

  if (!hostelName) return null;

  return (
    <aside className="map-drawer" aria-label={`${hostelName} listings drawer`}>
      {/* Mobile Drag Handle */}
      <div className="map-drawer-drag">
        <div className="map-drag-bar" />
      </div>

      {/* Header */}
      <div className="map-drawer-header">
        <div className="map-drawer-header-top">
          <div className="map-drawer-header-left">
            <div className="map-hostel-icon">
              <Icon name="home" className="icon i20" />
            </div>
            <div>
              <h3 className="map-hostel-title">
                {hostelName}
              </h3>
              <div className="map-hostel-sub">
                {proximityInfo ? (
                  <span style={{ color: proximityInfo.isSame ? "var(--good, #10b981)" : "var(--brand, #02505f)", fontWeight: 600 }}>
                    {proximityInfo.label}
                  </span>
                ) : (
                  <span>
                    {hostelListings.length} {hostelListings.length === 1 ? "item" : "items"} available here
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="map-drawer-close"
            aria-label="Close drawer"
            title="Close drawer"
          >
            <Icon name="x" className="icon i16" />
          </button>
        </div>

        {/* Local Filter & Search Controls */}
        <div className="map-drawer-controls">
          <div className="map-drawer-search">
            <span style={{ color: "var(--muted, #64748b)", display: "flex", alignItems: "center" }}>
              <Icon name="search" className="icon i14" />
            </span>
            <input
              type="text"
              placeholder={`Filter items in ${hostelName}...`}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="map-drawer-search-input"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 2 }}
                aria-label="Clear filter search"
              >
                <Icon name="x" className="icon i12" />
              </button>
            )}
          </div>

          <div className="map-drawer-pills">
            <button
              type="button"
              className={`map-filter-pill ${filterMode === "all" ? "is-active" : ""}`}
              onClick={() => setFilterMode("all")}
            >
              All ({hostelListings.length})
            </button>
            {dropsCount > 0 && (
              <button
                type="button"
                className={`map-filter-pill ${filterMode === "drop" ? "is-active" : ""}`}
                onClick={() => setFilterMode("drop")}
                style={filterMode !== "drop" ? { color: "#e11d48", borderColor: "#fecdd3", background: "#fff1f2" } : { background: "#e11d48", borderColor: "#e11d48" }}
              >
                <Icon name="flame" className="icon i12" />
                Drops ({dropsCount})
              </button>
            )}
            <button
              type="button"
              className={`map-filter-pill ${filterMode === "sell" ? "is-active" : ""}`}
              onClick={() => setFilterMode("sell")}
            >
              For Sale ({sellCount})
            </button>
            <button
              type="button"
              className={`map-filter-pill ${filterMode === "rent" ? "is-active" : ""}`}
              onClick={() => setFilterMode("rent")}
            >
              Rentals ({rentCount})
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="map-drawer-list">
        {/* Active Food Drop Banner at top if present and in 'all' view */}
        {filterMode === "all" && activeDrops.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeDrops.map((drop) => (
              <Link
                key={drop.id}
                href={`/item/${drop.id}`}
                style={{
                  padding: "10px 14px",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(225, 29, 72, 0.08)",
                  transition: "transform 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#e11d48", display: "flex", alignItems: "center" }}>
                    <Icon name="flame" className="icon i20" />
                  </span>
                  <div>
                    <b style={{ color: "#9f1239", fontSize: "13.5px", display: "block" }}>
                      Food Drop: {drop.title}
                    </b>
                    <span style={{ color: "#e11d48", fontSize: "11.5px", fontWeight: 600 }}>
                      {drop.price === 0 ? "Free drop" : `₹${drop.price}`} · Ready at {drop.pickupHostel}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#ffffff",
                    background: "#e11d48",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    flexShrink: 0,
                  }}
                >
                  Claim
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Regular Items List */}
        {displayedListings.length === 0 ? (
          <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            <span style={{ color: "var(--muted)", display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Icon name="pkg" className="icon i28" />
            </span>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink, #0f172a)" }}>
              No items found
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px" }}>
              {localSearch
                ? `No items match "${localSearch}" in ${hostelName}.`
                : `No ${filterMode !== "all" ? filterMode : ""} listings available in ${hostelName} right now.`}
            </p>
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                style={{
                  marginTop: 12,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid var(--line)",
                  background: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--brand, #02505f)",
                  cursor: "pointer",
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          displayedListings.map((item) => {
            const isDrop = item.mode === "drop";
            const isRent = item.mode === "rent";
            const isAuction = item.mode === "auction";

            const tagClass = isDrop
              ? "map-tag-drop"
              : isRent
              ? "map-tag-rent"
              : isAuction
              ? "map-tag-auction"
              : "map-tag-sale";

            const modeLabel = isDrop
              ? "Food Drop"
              : isRent
              ? item.rentUnit === "hour" ? "Hourly" : "Rent"
              : isAuction
              ? "Auction"
              : item.isBundle
              ? `Bundle (${item.bundleCount})`
              : "Sale";

            return (
              <Link
                key={item.id}
                href={`/item/${item.id}`}
                className="map-item-card"
              >
                <div className="map-thumb-box">
                  {item.photo?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photo.url}
                      alt={item.title}
                      className="map-thumb-img"
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ color: "var(--muted)", display: "flex" }}>
                      <Icon name="pkg" className="icon i20" />
                    </span>
                  )}
                </div>

                <div className="map-item-details">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span className={`map-mode-tag ${tagClass}`}>
                      {modeLabel}
                    </span>
                    {item.mrp && item.mrp > item.price && (
                      <span style={{ fontSize: "10.5px", color: "var(--text-muted, #94a3b8)", textDecoration: "line-through" }}>
                        ₹{item.mrp}
                      </span>
                    )}
                  </div>

                  <b className="map-item-title">
                    {item.title}
                  </b>

                  <div className="map-price-row">
                    <span className="map-price-val">
                      {fmt(item.price)}
                      {isRent && item.rentUnit ? ` / ${item.rentUnit}` : ""}
                    </span>
                    {isRent && item.deposit ? (
                      <span style={{ fontSize: "10.5px", color: "var(--text-muted, #64748b)" }}>
                        + {fmt(item.deposit)} dep
                      </span>
                    ) : null}
                  </div>

                  <div className="map-seller-row">
                    <span>by {item.seller.name.split(" ")[0]}</span>
                    <span>·</span>
                    <span className="map-seller-plume" title="Plume Trust Score">
                      <span style={{ color: "var(--brand, #02505f)", display: "flex", alignItems: "center" }}>
                        <Icon name="shield" className="icon i12" />
                      </span>
                      Plume {Math.round(item.seller.plume)}
                    </span>
                  </div>
                </div>

                <div className="map-item-arrow">
                  <Icon name="chev" className="icon i16" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
