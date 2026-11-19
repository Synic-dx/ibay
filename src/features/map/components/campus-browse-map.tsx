"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Marker, MapRef } from "react-map-gl/maplibre";
import type { ListingCard } from "@/features/listings/types";
import { HOSTELS } from "@/lib/validation/auth";
import { Icon } from "@/components/ui/icon";
import { getResidenceCoordinates } from "../proximity";
import MapDrawer from "./map-drawer";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#94a3b8",
        fontSize: "14px",
      }}
    >
      Loading Campus Map...
    </div>
  ),
});

export interface CampusBrowseMapProps {
  listings: ListingCard[];
}

type FilterMode = "all" | "drop" | "rent" | "sell";

export default function CampusBrowseMap({ listings }: CampusBrowseMapProps) {
  const searchParams = useSearchParams();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHostel, setSelectedHostel] = useState<string | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  // Deep-link handling (from /map?lat=...&lng=...&name=...)
  useEffect(() => {
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const nameParam = searchParams.get("name");

    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      if (!isNaN(lat) && !isNaN(lng)) {
        setTimeout(() => {
          mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 17.5,
            duration: 800,
          });
        }, 400);
      }
    }

    if (nameParam) {
      setSelectedHostel(decodeURIComponent(nameParam));
    }
  }, [searchParams]);

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (filterMode === "drop" && l.mode !== "drop") return false;
      if (filterMode === "rent" && l.mode !== "rent") return false;
      if (filterMode === "sell" && l.mode !== "sell" && l.mode !== "auction") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = l.title.toLowerCase().includes(q);
        const matchesHostel = l.pickupHostel.toLowerCase().includes(q);
        if (!matchesTitle && !matchesHostel) return false;
      }

      return true;
    });
  }, [listings, filterMode, searchQuery]);

  // Aggregate listings by hostel
  const hostelClusters = useMemo(() => {
    const clusters: Array<{
      name: string;
      coords: { lat: number; lng: number };
      count: number;
      hasDrops: boolean;
    }> = [];

    for (const h of HOSTELS) {
      if (h === "Day scholar") continue;
      const coords = getResidenceCoordinates(h);
      if (!coords) continue;

      const itemsInHostel = filteredListings.filter(
        (l) => l.pickupHostel.toLowerCase() === h.toLowerCase()
      );
      const hasDrops = itemsInHostel.some((l) => l.mode === "drop");

      clusters.push({
        name: h,
        coords,
        count: itemsInHostel.length,
        hasDrops,
      });
    }

    return clusters;
  }, [filteredListings]);

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
      {/* Top Floating Filter Bar */}
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          right: "14px",
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "480px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            padding: "4px 8px",
          }}
        >
          <span style={{ color: "#64748b", padding: "0 6px", display: "flex", alignItems: "center" }}>
            <Icon name="search" className="icon i16" />
          </span>
          <input
            type="text"
            placeholder="Search items or hostels (e.g. SR 18, calculator, cycles)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "13px",
              padding: "8px 4px",
              color: "#0f172a",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "4px 6px",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Icon name="x" className="icon i14" />
            </button>
          )}
        </div>

        {/* Mode Filter Pills */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
          {(
            [
              ["all", "All Items"],
              ["drop", "Food Drops"],
              ["sell", "For Sale"],
              ["rent", "Rentals"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              style={{
                whiteSpace: "nowrap",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                borderColor: filterMode === mode ? "transparent" : "rgba(255,255,255,0.7)",
                background: filterMode === mode ? "#02505F" : "rgba(255, 255, 255, 0.9)",
                color: filterMode === mode ? "#ffffff" : "#1e293b",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Full-Screen Campus Map */}
      <CampusMap
        id="campus-browse-map"
        mapRef={mapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{
          latitude: 22.6262,
          longitude: 75.7906,
          zoom: 16.3,
        }}
      >
        {/* Render Hostel Cluster Badges */}
        {hostelClusters.map((cluster) => {
          const isSelected = selectedHostel === cluster.name;

          return (
            <Marker
              key={cluster.name}
              latitude={cluster.coords.lat}
              longitude={cluster.coords.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedHostel(cluster.name);
                mapRef.current?.flyTo({
                  center: [cluster.coords.lng, cluster.coords.lat],
                  zoom: 17.2,
                  duration: 400,
                });
              }}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transform: isSelected ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.15s ease",
                }}
                title={`${cluster.name}: ${cluster.count} listings`}
              >
                {cluster.hasDrops ? (
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#e11d48",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      boxShadow: "0 0 12px #e11d48, 0 4px 8px rgba(0,0,0,0.3)",
                      border: "2px solid #ffffff",
                      animation: "pulse 1.8s infinite",
                    }}
                  >
                    <Icon name="flame" className="icon i18" />
                  </div>
                ) : cluster.count > 0 ? (
                  <div
                    style={{
                      minWidth: "28px",
                      height: "28px",
                      padding: "0 6px",
                      borderRadius: "14px",
                      background: "#02505F",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      border: "2px solid #ffffff",
                    }}
                  >
                    {cluster.count}
                  </div>
                ) : (
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.75)",
                      border: "1.5px solid #64748b",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    }}
                  />
                )}
                <span
                  style={{
                    marginTop: "2px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#ffffff",
                    textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000000",
                    letterSpacing: "0.2px",
                  }}
                >
                  {cluster.name}
                </span>
              </div>
            </Marker>
          );
        })}
      </CampusMap>

      {/* Slide-Up Hostel Inventory Drawer */}
      <MapDrawer
        hostelName={selectedHostel}
        listings={filteredListings}
        onClose={() => setSelectedHostel(null)}
      />
    </div>
  );
}
