"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Marker, MapRef } from "react-map-gl/maplibre";
import { getResidenceCoordinates, findNearestLandmark } from "../proximity";
import { HOSTELS } from "@/lib/validation/auth";
import { Icon } from "@/components/ui/icon";
import styles from "./map.module.css";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "260px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-raised, #f8fafc)",
        color: "var(--text-muted, #64748b)",
        fontSize: "13px",
        borderRadius: "12px",
      }}
    >
      Loading Campus Map...
    </div>
  ),
});

interface SpotPickerProps {
  initialHostel?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  initialNote?: string;
  onChange: (data: {
    hostel: string;
    lat: number | null;
    lng: number | null;
    note: string;
  }) => void;
}

export default function SpotPicker({
  initialHostel = "SR 18",
  initialLat = null,
  initialLng = null,
  initialNote = "",
  onChange,
}: SpotPickerProps) {
  const [selectedHostel, setSelectedHostel] = useState<string>(initialHostel);
  const defaultCoords = useMemo(() => {
    if (initialLat && initialLng) {
      return { lat: initialLat, lng: initialLng };
    }
    const resolved = getResidenceCoordinates(initialHostel);
    return resolved || { lat: 22.6262, lng: 75.7906 };
  }, [initialHostel, initialLat, initialLng]);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>(defaultCoords);
  const [note, setNote] = useState<string>(initialNote);
  const mapRef = useRef<MapRef | null>(null);

  const nearestLandmark = useMemo(() => {
    return findNearestLandmark(coords.lat, coords.lng);
  }, [coords.lat, coords.lng]);

  const snapToResidence = useCallback(
    (hostelName: string) => {
      const res = getResidenceCoordinates(hostelName);
      if (res) {
        setCoords(res);
        setSelectedHostel(hostelName);
        onChange({
          hostel: hostelName,
          lat: res.lat,
          lng: res.lng,
          note,
        });
        mapRef.current?.flyTo({
          center: [res.lng, res.lat],
          zoom: 17,
          duration: 500,
        });
      }
    },
    [note, onChange]
  );

  const handleMapClick = useCallback(
    (e: { lngLat: { lng: number; lat: number } }) => {
      const newCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setCoords(newCoords);
      onChange({
        hostel: selectedHostel,
        lat: newCoords.lat,
        lng: newCoords.lng,
        note,
      });
    },
    [selectedHostel, note, onChange]
  );

  const handleMarkerDragEnd = useCallback(
    (e: { lngLat: { lng: number; lat: number } }) => {
      const newCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setCoords(newCoords);
      onChange({
        hostel: selectedHostel,
        lat: newCoords.lat,
        lng: newCoords.lng,
        note,
      });
    },
    [selectedHostel, note, onChange]
  );

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, 300);
    setNote(val);
    onChange({
      hostel: selectedHostel,
      lat: coords.lat,
      lng: coords.lng,
      note: val,
    });
  };

  return (
    <div className={styles.spotPickerWrapper}>
      <div className={styles.spotPickerHeader}>
        <div>
          <div className={styles.spotPickerTitle}>
            <span style={{ color: "var(--brand, #02505F)", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="pin" className="icon i16" />
              Pickup Spot on Campus
            </span>
          </div>
          <p className={styles.spotPickerSubtitle}>
            Drop or drag a pin where the buyer can meet you for handover.
          </p>
        </div>
        {initialHostel && initialHostel !== "Day scholar" && (
          <button
            type="button"
            className={styles.snapBtn}
            onClick={() => snapToResidence(initialHostel)}
            title={`Snap pin to ${initialHostel}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Icon name="home" className="icon i14" />
            <span>Snap to {initialHostel}</span>
          </button>
        )}
      </div>

      <div style={{ height: "260px", width: "100%" }}>
        <CampusMap
          initialViewState={{
            latitude: coords.lat,
            longitude: coords.lng,
            zoom: 16.5,
          }}
          mapRef={mapRef}
          onClick={handleMapClick}
        >
          <Marker
            latitude={coords.lat}
            longitude={coords.lng}
            draggable
            onDragEnd={handleMarkerDragEnd}
            anchor="bottom"
          >
            <div className={styles.pinMarker} title="Drag to adjust pickup spot">
              <svg
                width="32"
                height="42"
                viewBox="0 0 32 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
                  fill="#E11D48"
                />
                <circle cx="16" cy="16" r="6.5" fill="#FFFFFF" />
              </svg>
            </div>
          </Marker>
        </CampusMap>
      </div>

      <div className={styles.selectedLocationBadge}>
        <div>
          <span className={styles.selectedSpotName}>
            {nearestLandmark
              ? `${nearestLandmark.location.name} (${nearestLandmark.distanceMeters}m away)`
              : selectedHostel}
          </span>
        </div>
        <span className={styles.selectedCoords}>
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </span>
      </div>

      <div className={styles.noteField}>
        <div className={styles.noteFieldLabel}>
          <span>Handover instructions (Optional)</span>
          <span className={styles.privacyLock} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="lock" className="icon i12" />
            <span>Only shared with buyer after deal confirmation</span>
          </span>
        </div>
        <textarea
          className={styles.noteTextarea}
          placeholder="e.g. Room 204, 2nd floor, knock or WhatsApp when downstairs."
          value={note}
          maxLength={300}
          onChange={handleNoteChange}
          rows={2}
        />
        <span className={styles.charCount}>{note.length} / 300</span>
      </div>
    </div>
  );
}
