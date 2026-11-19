"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Marker } from "react-map-gl/maplibre";
import { Icon } from "@/components/ui/icon";
import { getResidenceCoordinates, calculateWalkingEffort, findNearestLandmark } from "../proximity";
import styles from "./map.module.css";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "180px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-raised, #f8fafc)",
        color: "var(--text-muted, #64748b)",
        fontSize: "12px",
        borderRadius: "10px",
      }}
    >
      Loading map preview...
    </div>
  ),
});

export interface PickupSnippetProps {
  pickupHostel: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  viewerHostel?: string | null;
  title?: string;
}

export default function PickupSnippet({
  pickupHostel,
  pickupLat,
  pickupLng,
  viewerHostel,
  title = "Item",
}: PickupSnippetProps) {
  const coords = useMemo(() => {
    if (pickupLat && pickupLng) {
      return { lat: pickupLat, lng: pickupLng };
    }
    const resolved = getResidenceCoordinates(pickupHostel);
    return resolved || { lat: 22.6262, lng: 75.7906 };
  }, [pickupHostel, pickupLat, pickupLng]);

  const nearestLandmark = useMemo(() => {
    return findNearestLandmark(coords.lat, coords.lng);
  }, [coords.lat, coords.lng]);

  const walkingEffort = useMemo(() => {
    if (!viewerHostel) return null;
    return calculateWalkingEffort(viewerHostel, coords.lat, coords.lng);
  }, [viewerHostel, coords.lat, coords.lng]);

  const isSameHostel = viewerHostel && viewerHostel.toLowerCase() === pickupHostel.toLowerCase();

  return (
    <div
      style={{
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: "var(--radius-md, 12px)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginTop: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink, #0f172a)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              margin: 0,
            }}
          >
            <span style={{ color: "var(--brand, #02505F)", display: "flex", alignItems: "center" }}>
              <Icon name="pin" className="icon i16" />
            </span>
            <span>Pickup Spot</span>
          </h4>
          <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
            {nearestLandmark
              ? `${nearestLandmark.location.name} (${pickupHostel})`
              : pickupHostel}
          </span>
        </div>
        <Link
          href={`/map?lat=${coords.lat}&lng=${coords.lng}&name=${encodeURIComponent(pickupHostel)}`}
          style={{
            fontSize: "12px",
            color: "var(--brand, #02505f)",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Open map</span>
          <Icon name="expand" className="icon i14" />
        </Link>
      </div>

      <div style={{ height: "180px", width: "100%", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
        <CampusMap
          id={`pickup-map-${pickupHostel.replace(/[^a-zA-Z0-9]/g, "-")}`}
          style={{ width: "100%", height: "100%" }}
          initialViewState={{
            latitude: coords.lat,
            longitude: coords.lng,
            zoom: 16.6,
          }}
          showControls={false}
          interactive={false}
        >
          <Marker latitude={coords.lat} longitude={coords.lng} anchor="bottom">
            <div style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
              <svg width="26" height="34" viewBox="0 0 32 42" fill="none">
                <path
                  d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
                  fill="#02505F"
                />
                <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
              </svg>
            </div>
          </Marker>
        </CampusMap>
      </div>

      {isSameHostel ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          <Icon name="zap" className="icon i14" />
          <span>In your hostel! ~1 min walk away</span>
        </div>
      ) : walkingEffort ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            background: "var(--bg-raised, #f8fafc)",
            color: "var(--ink, #1e293b)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        >
          <span style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}>
            <Icon name="compass" className="icon i14" />
          </span>
          <span>
            <b>{walkingEffort.distanceMeters}m</b> ({walkingEffort.steps} steps) · ~{walkingEffort.durationMinutes} min walk from {viewerHostel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
