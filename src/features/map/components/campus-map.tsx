"use client";

import React, { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import MapGl, { Source, Layer, MapRef, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import campusOutline from "../data/campus-outline.json";
import styles from "./map.module.css";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

export const CAMPUS_BOUNDS: [number, number, number, number] = [
  75.783, 22.621, // Southwest (minLng, minLat)
  75.799, 22.633, // Northeast (maxLng, maxLat)
];

export const CAMPUS_CENTER = {
  latitude: 22.6262,
  longitude: 75.7906,
  zoom: 16.2,
};

export const ESRI_SATELLITE_STYLE: any = {
  version: 8,
  name: "Esri World Imagery Hybrid",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Tiles &copy; Esri",
    },
    "esri-transportation": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
    },
    "esri-labels": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-world-imagery-layer",
      type: "raster",
      source: "esri-world-imagery",
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: "esri-transportation-layer",
      type: "raster",
      source: "esri-transportation",
      minzoom: 0,
      maxzoom: 24,
      paint: { "raster-opacity": 0.75 },
    },
    {
      id: "esri-labels-layer",
      type: "raster",
      source: "esri-labels",
      minzoom: 0,
      maxzoom: 24,
      paint: { "raster-opacity": 0.85 },
    },
  ],
};

export interface CampusMapProps {
  initialViewState?: {
    latitude: number;
    longitude: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
  };
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  onClick?: (e: { lngLat: { lng: number; lat: number } }) => void;
  showControls?: boolean;
  interactive?: boolean;
  minZoom?: number;
  maxZoom?: number;
  mapRef?: React.RefObject<MapRef | null>;
}

export default function CampusMap({
  initialViewState = CAMPUS_CENTER,
  className = "",
  style,
  children,
  onClick,
  showControls = true,
  interactive = true,
  minZoom = 14,
  maxZoom = 19.5,
  mapRef: externalMapRef,
}: CampusMapProps) {
  const [mounted, setMounted] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const internalMapRef = useRef<MapRef | null>(null);
  const mapRef = externalMapRef || internalMapRef;

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle3D = useCallback(() => {
    const current = mapRef.current;
    if (!current) return;
    const next3D = !is3D;
    setIs3D(next3D);
    current.easeTo({
      pitch: next3D ? 50 : 0,
      bearing: next3D ? 25 : 0,
      duration: 800,
    });
  }, [is3D, mapRef]);

  const resetView = useCallback(() => {
    const current = mapRef.current;
    if (!current) return;
    current.flyTo({
      center: [CAMPUS_CENTER.longitude, CAMPUS_CENTER.latitude],
      zoom: CAMPUS_CENTER.zoom,
      pitch: is3D ? 50 : 0,
      bearing: is3D ? 25 : 0,
      duration: 600,
    });
  }, [is3D, mapRef]);

  if (!mounted) {
    return (
      <div
        className={`${styles.mapContainer} ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted, #64748b)",
          fontSize: 13,
          minHeight: 280,
          ...style,
        }}
      >
        <span>Loading Campus Map...</span>
      </div>
    );
  }

  return (
    <div className={`${styles.mapContainer} ${className}`} style={style}>
      <MapGl
        ref={mapRef as any}
        initialViewState={{
          latitude: initialViewState.latitude,
          longitude: initialViewState.longitude,
          zoom: initialViewState.zoom ?? CAMPUS_CENTER.zoom,
          pitch: initialViewState.pitch ?? 0,
          bearing: initialViewState.bearing ?? 0,
        }}
        maxBounds={CAMPUS_BOUNDS}
        minZoom={minZoom}
        maxZoom={maxZoom}
        mapStyle={ESRI_SATELLITE_STYLE}
        style={{ width: "100%", height: "100%" }}
        onClick={interactive ? onClick : undefined}
        dragPan={interactive}
        scrollZoom={interactive}
        boxZoom={interactive}
        dragRotate={interactive}
        keyboard={interactive}
        doubleClickZoom={interactive}
        touchZoomRotate={interactive}
      >
        {/* Campus Outer Boundary Glow */}
        <Source id="campus-boundary" type="geojson" data={campusOutline as any}>
          <Layer
            id="campus-boundary-outer-glow"
            type="line"
            paint={{
              "line-color": "#f5a623",
              "line-width": 5,
              "line-opacity": 0.35,
              "line-blur": 3,
            }}
          />
          <Layer
            id="campus-boundary-line"
            type="line"
            paint={{
              "line-color": "#f5a623",
              "line-width": 2,
              "line-opacity": 0.9,
            }}
          />
        </Source>

        {children}
      </MapGl>

      {showControls && (
        <div className={styles.mapControls}>
          <button
            type="button"
            className={`${styles.controlBtn} ${is3D ? styles.controlBtnActive : ""}`}
            onClick={toggle3D}
            title={is3D ? "Switch to 2D view" : "Switch to 3D tilted view"}
            aria-label="Toggle 3D View"
          >
            {is3D ? "2D" : "3D"}
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={resetView}
            title="Recenter campus"
            aria-label="Recenter Campus Map"
          >
            ⌖
          </button>
        </div>
      )}
    </div>
  );
}
