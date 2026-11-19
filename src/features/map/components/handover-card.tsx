"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Marker, Source, Layer } from "react-map-gl/maplibre";
import { Icon } from "@/components/ui/icon";
import type { Deal } from "@/features/deals/stages";
import HandoverStatusBadge from "@/features/deals/components/handover-status-badge";
import { getResidenceCoordinates, findNearestLandmark } from "../proximity";
import { findShortestCampusPath } from "../pathfinder";
import type { NavigationRoute } from "../types";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "190px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-raised, #f8fafc)",
        color: "var(--text-muted, #64748b)",
        fontSize: "12px",
        borderRadius: "10px",
      }}
    >
      Loading route map...
    </div>
  ),
});

export interface HandoverCardProps {
  deal: Deal;
  viewerHostel?: string | null;
  currentUserId?: string;
}

export default function HandoverCard({ deal, viewerHostel, currentUserId }: HandoverCardProps) {
  const [showMap, setShowMap] = useState(false);

  const destCoords = useMemo(() => {
    if (deal.listing.pickupLat && deal.listing.pickupLng) {
      return { lat: deal.listing.pickupLat, lng: deal.listing.pickupLng };
    }
    const resolved = getResidenceCoordinates(deal.listing.pickupHostel);
    return resolved || { lat: 22.6262, lng: 75.7906 };
  }, [deal.listing.pickupLat, deal.listing.pickupLng, deal.listing.pickupHostel]);

  const originCoords = useMemo(() => {
    if (!viewerHostel) return null;
    return getResidenceCoordinates(viewerHostel);
  }, [viewerHostel]);

  const route: NavigationRoute | null = useMemo(() => {
    if (!originCoords) return null;
    return findShortestCampusPath(
      [originCoords.lng, originCoords.lat],
      [destCoords.lng, destCoords.lat]
    );
  }, [originCoords, destCoords]);

  const routeGeojson = useMemo(() => {
    if (!route || !route.coordinates.length) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.coordinates,
      },
    };
  }, [route]);

  const landmark = useMemo(() => {
    return findNearestLandmark(destCoords.lat, destCoords.lng);
  }, [destCoords.lat, destCoords.lng]);

  return (
    <div
      style={{
        margin: "10px 0 6px",
        padding: "12px 14px",
        background: "var(--bg-raised, #f8fafc)",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Handover scheduling badge */}
      {deal.handoverScheduledAt && (
        <HandoverStatusBadge
          txId={deal.id}
          scheduledAt={deal.handoverScheduledAt}
          status={deal.handoverStatus}
          proposedBy={deal.handoverProposedBy}
          currentUserId={currentUserId}
          otherName={deal.other.name.split(" ")[0]}
          listingTitle={deal.listing.title}
          locationName={landmark ? landmark.location.name : deal.listing.pickupHostel}
          sellerSlots={deal.listing.pickupSlots}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "var(--brand, #02505f)", display: "flex", alignItems: "center" }}>
            <Icon name="pin" className="icon i16" />
          </span>
          <b style={{ fontSize: "13px", color: "var(--ink, #0f172a)" }}>
            Pickup: {landmark ? `${landmark.location.name}` : deal.listing.pickupHostel}
          </b>
        </div>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--brand, #02505f)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{showMap ? "Hide map" : "View route on map"}</span>
          <Icon name={showMap ? "up" : "down"} className="icon i14" />
        </button>
      </div>

      {deal.handoverNote && (
        <div
          style={{
            padding: "8px 10px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#1e3a8a",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "11px", color: "#1d4ed8", display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="lock" className="icon i14" />
            Seller Handover Instructions
          </span>
          <span>{deal.handoverNote}</span>
        </div>
      )}

      {route && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted, #475569)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}>
            <Icon name="compass" className="icon i14" />
          </span>
          <span>
            <b>{route.totalDistanceMeters}m</b> ({route.stepCount} steps) · ~{route.estimatedDurationMinutes} min walk from {viewerHostel}
          </span>
        </div>
      )}

      {showMap && (
        <div style={{ height: "190px", width: "100%", borderRadius: "8px", overflow: "hidden", marginTop: "4px" }}>
          <CampusMap
            initialViewState={{
              latitude: destCoords.lat,
              longitude: destCoords.lng,
              zoom: 16.4,
            }}
            showControls={false}
          >
            {/* Origin marker */}
            {originCoords && (
              <Marker latitude={originCoords.lat} longitude={originCoords.lng} anchor="bottom">
                <div style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
                  <svg width="24" height="30" viewBox="0 0 32 42" fill="none">
                    <path
                      d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
                      fill="#3B82F6"
                    />
                    <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
                  </svg>
                </div>
              </Marker>
            )}

            {/* Destination marker */}
            <Marker latitude={destCoords.lat} longitude={destCoords.lng} anchor="bottom">
              <div style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
                <svg width="26" height="34" viewBox="0 0 32 42" fill="none">
                  <path
                    d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
                    fill="#E11D48"
                  />
                  <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
                </svg>
              </div>
            </Marker>

            {/* Polyline Route Layer */}
            {routeGeojson && (
              <Source id="handover-route" type="geojson" data={routeGeojson as any}>
                <Layer
                  id="handover-route-casing"
                  type="line"
                  paint={{
                    "line-color": "#ffffff",
                    "line-width": 5,
                    "line-opacity": 0.8,
                  }}
                />
                <Layer
                  id="handover-route-line"
                  type="line"
                  paint={{
                    "line-color": "#02505F",
                    "line-width": 3,
                    "line-opacity": 0.95,
                  }}
                />
              </Source>
            )}
          </CampusMap>
        </div>
      )}
    </div>
  );
}
