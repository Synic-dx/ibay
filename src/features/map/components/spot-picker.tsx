"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Marker, MapRef } from "react-map-gl/maplibre";
import {
  getResidenceCoordinates,
  findNearestLandmark,
  findNearestResidence,
} from "../proximity";
import { HOSTELS } from "@/lib/validation/auth";
import campusLocations from "../data/campus-locations.json";
import type { CampusLocation } from "../types";
import { Icon } from "@/components/ui/icon";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "240px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-2)",
        color: "var(--ink-3)",
        fontSize: "13px",
        borderRadius: "14px",
      }}
    >
      Loading Campus Map...
    </div>
  ),
});

const allLocations: CampusLocation[] = (campusLocations as CampusLocation[]).filter(
  (l) => l.name !== "__CAMPUS_PATH_METADATA__"
);

const HOSTEL_LOCATIONS = allLocations
  .filter((l) => l.category === "Hostel" || (HOSTELS as readonly string[]).includes(l.name))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

const ACADEMIC_LOCATIONS = allLocations
  .filter((l) => l.category === "Academic" || l.category === "Administrative" || l.category === "Library")
  .sort((a, b) => a.name.localeCompare(b.name));

const CAFE_LOCATIONS = allLocations
  .filter((l) => l.category === "Cafe & Eatery" || l.category === "Mess & Dining")
  .sort((a, b) => a.name.localeCompare(b.name));

const SPORTS_LOCATIONS = allLocations
  .filter((l) => l.category === "Sports & Gym" || l.category === "Stadium & Grounds")
  .sort((a, b) => a.name.localeCompare(b.name));

const OTHER_LOCATIONS = allLocations
  .filter(
    (l) =>
      l.category === "Gates & Parking" ||
      l.category === "Facilities & Utilities" ||
      l.category === "Medical Center" ||
      l.category === "General Store"
  )
  .sort((a, b) => a.name.localeCompare(b.name));

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

  const updatePositionAndHostel = useCallback(
    (newCoords: { lat: number; lng: number }) => {
      setCoords(newCoords);
      const landmark = findNearestLandmark(newCoords.lat, newCoords.lng);
      const nearestRes = findNearestResidence(newCoords.lat, newCoords.lng);

      let resolvedHostel = selectedHostel;
      if (
        landmark &&
        landmark.distanceMeters <= 75 &&
        (HOSTELS as readonly string[]).includes(landmark.location.name)
      ) {
        resolvedHostel = landmark.location.name;
      } else if (nearestRes && (HOSTELS as readonly string[]).includes(nearestRes.location.name)) {
        resolvedHostel = nearestRes.location.name;
      }

      setSelectedHostel(resolvedHostel);
      onChange({
        hostel: resolvedHostel,
        lat: newCoords.lat,
        lng: newCoords.lng,
        note,
      });
    },
    [selectedHostel, note, onChange]
  );

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

  const handleLocationDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locName = e.target.value;
    if (!locName) return;

    const found = allLocations.find((l) => l.name === locName);
    if (!found) return;

    const newCoords = { lat: found.lat, lng: found.lng };
    setCoords(newCoords);

    let resolvedHostel = selectedHostel;
    if ((HOSTELS as readonly string[]).includes(found.name)) {
      resolvedHostel = found.name;
    } else {
      const nearestRes = findNearestResidence(found.lat, found.lng);
      if (nearestRes && (HOSTELS as readonly string[]).includes(nearestRes.location.name)) {
        resolvedHostel = nearestRes.location.name;
      }
    }

    setSelectedHostel(resolvedHostel);
    onChange({
      hostel: resolvedHostel,
      lat: newCoords.lat,
      lng: newCoords.lng,
      note,
    });

    mapRef.current?.flyTo({
      center: [newCoords.lng, newCoords.lat],
      zoom: 17,
      duration: 600,
    });
  };

  const handleMapClick = useCallback(
    (e: { lngLat: { lng: number; lat: number } }) => {
      updatePositionAndHostel({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    },
    [updatePositionAndHostel]
  );

  const handleMarkerDragEnd = useCallback(
    (e: { lngLat: { lng: number; lat: number } }) => {
      updatePositionAndHostel({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    },
    [updatePositionAndHostel]
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

  const spotDisplayName = useMemo(() => {
    if (!nearestLandmark) return selectedHostel;
    if (nearestLandmark.distanceMeters <= 20) {
      return nearestLandmark.location.name;
    }
    return nearestLandmark.location.name;
  }, [nearestLandmark, selectedHostel]);

  const spotSubtitle = useMemo(() => {
    if (!nearestLandmark) return `Near ${selectedHostel}`;
    if (nearestLandmark.distanceMeters <= 10) {
      return `${nearestLandmark.location.category || "Campus Location"} · Exact pin spot`;
    }
    return `${nearestLandmark.location.category || "Campus"} · ${nearestLandmark.distanceMeters}m from pin`;
  }, [nearestLandmark, selectedHostel]);

  return (
    <div className="spot-picker-box">
      {/* Header */}
      <div className="spot-picker-head">
        <div>
          <div className="spot-picker-title">
            <span style={{ color: "var(--brand)", display: "flex", alignItems: "center" }}>
              <Icon name="pin" className="icon i18" />
            </span>
            <span>Pickup Spot on Campus</span>
          </div>
          <p className="spot-picker-sub">
            Pick a landmark below or click / drag the map pin to where the buyer meets you.
          </p>
        </div>
        {initialHostel && initialHostel !== "Day scholar" && (
          <button
            type="button"
            className="spot-snap-btn"
            onClick={() => snapToResidence(initialHostel)}
            title={`Snap pin to ${initialHostel}`}
          >
            <Icon name="home" className="icon i14" />
            <span>Snap to {initialHostel}</span>
          </button>
        )}
      </div>

      {/* Quick Location Select Dropdown */}
      <div className="spot-select-wrap">
        <label htmlFor="spot-location-select" className="spot-select-label">
          <Icon name="compass" className="icon i14" />
          <span>Quick-select building or landmark</span>
        </label>
        <select
          id="spot-location-select"
          className="spot-dropdown"
          value={nearestLandmark?.distanceMeters && nearestLandmark.distanceMeters <= 25 ? nearestLandmark.location.name : ""}
          onChange={handleLocationDropdownSelect}
          aria-label="Select campus building or landmark"
        >
          <option value="">-- Choose a location on campus --</option>
          <optgroup label="Hostels & Student Residences">
            {HOSTEL_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Academic & Administrative Blocks">
            {ACADEMIC_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Cafes, Mess & Dining">
            {CAFE_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sports Complex & Stadiums">
            {SPORTS_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Campus Gates & Facilities">
            {OTHER_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* 3D Satellite Map Frame */}
      <div className="spot-map-frame">
        <CampusMap
          id="spot-picker-map"
          style={{ width: "100%", height: "100%" }}
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
            <div className="spot-pin-svg" title="Drag to adjust pickup spot">
              <svg width="34" height="44" viewBox="0 0 32 42" fill="none">
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

      {/* Selected Location Card */}
      <div className="spot-selected-card">
        <div className="spot-selected-left">
          <div className="spot-selected-icon">
            <Icon name="pin" className="icon i18" />
          </div>
          <div>
            <div className="spot-selected-name">{spotDisplayName}</div>
            <div className="spot-selected-dist">{spotSubtitle}</div>
          </div>
        </div>
        <div className="spot-selected-coords">
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </div>
      </div>

      {/* Handover Instructions Field */}
      <div className="spot-notes-box">
        <div className="spot-notes-head">
          <label htmlFor="spot-notes-textarea" className="spot-notes-label">
            Handover instructions <small style={{ color: "var(--ink-3)", fontWeight: 400 }}>(Optional)</small>
          </label>
          <span className="spot-notes-privacy">
            <Icon name="shield" className="icon i12" />
            <span>Private · Only shared after deal</span>
          </span>
        </div>
        <textarea
          id="spot-notes-textarea"
          className="spot-notes-input"
          placeholder="e.g. Room 204, 2nd floor, knock or WhatsApp when downstairs."
          value={note}
          maxLength={300}
          onChange={handleNoteChange}
          rows={3}
        />
        <div className="spot-notes-foot">
          <span>Add room, wing, floor or meeting details</span>
          <span className="spot-char-count">{note.length} / 300</span>
        </div>
      </div>
    </div>
  );
}
