"use client";
/**
 * FEATURE: Product card [RUBRIC:DATA-DISPLAY]
 * WHAT: The raised card used in every grid and rail: photo tile, deal badge,
 *       age badge, heart, title, price line, "Price dropped" and the seller's
 *       hostel + trust in words.
 * GUESTS: tapping the card or the heart opens the sign-in modal instead.
 */
import Link from "@/components/ui/link";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { useApp } from "@/components/app-context";
import { fmt } from "@/lib/format";
import { findNearestResidence, getResidenceCoordinates, calculateDistanceMeters } from "@/features/map/proximity";
import { toggleSave } from "../actions/save";
import type { ListingCard } from "../types";
import { AgeBadge, ModeBadge, PhotoTile, PriceDrop, PriceLine, TrustLine } from "./parts";

export function ProductCard({ l, preview = false }: { l: ListingCard; preview?: boolean }) {
  const { viewer, openAuth } = useApp();
  const [saved, setSaved] = useState(l.saved);
  const [, start] = useTransition();

  const effectiveHostel = useMemo(() => {
    if (l.pickupLat && l.pickupLng) {
      const res = findNearestResidence(l.pickupLat, l.pickupLng);
      if (res && res.distanceMeters <= 80) return res.location.name;
    }
    return l.pickupHostel;
  }, [l.pickupLat, l.pickupLng, l.pickupHostel]);

  const near = useMemo(() => {
    if (!viewer || viewer.id === l.seller.id) return false;
    if (viewer.hostel.trim().toLowerCase() !== effectiveHostel.trim().toLowerCase()) return false;
    if (l.pickupLat && l.pickupLng) {
      const vCoords = getResidenceCoordinates(viewer.hostel);
      if (vCoords) {
        const d = calculateDistanceMeters(vCoords.lat, vCoords.lng, l.pickupLat, l.pickupLng);
        if (d > 55) return false;
      }
    }
    return true;
  }, [viewer, effectiveHostel, l.pickupLat, l.pickupLng, l.seller.id]);

  const href = `/item/${l.id}`;

  const gate = (e: React.MouseEvent) => {
    if (viewer || preview) return;
    e.preventDefault();
    openAuth({
      reason: "Sign in to see full details, book and chat with the seller",
      next: href,
      listing: { title: l.title, photo: l.photo?.url ?? null, price: fmt(l.price) + (l.mrp ? ` · worth ${fmt(l.mrp)} new` : "") },
    });
  };

  const heart = () => {
    if (!viewer) {
      openAuth({ reason: "Sign in to save items and get price drop alerts", next: href });
      return;
    }
    start(async () => {
      setSaved(!saved);
      const r = await toggleSave(l.id);
      if (r.ok) {
        setSaved(r.data.saved);
        toast(r.message);
      } else {
        setSaved(saved);
        toast.error(r.formError);
      }
    });
  };

  return (
    <article className="pc">
      <PhotoTile l={l}>
        <ModeBadge l={l} />
        <AgeBadge l={l} />
        {!preview && (
          <button type="button" className={`heart ${saved ? "on" : ""}`} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} onClick={heart}>
            <Icon name="heart" />
          </button>
        )}
      </PhotoTile>
      <div className="bd">
        <div className="tt">
          {preview ? l.title : (
            <Link href={href} onClick={gate}>
              {l.title}
            </Link>
          )}
        </div>
        <PriceLine l={l} />
        <PriceDrop l={l} />
        <div className="who">
          {near ? (
            <span className="near">
              <Icon name="pin" />
              Your hostel
            </span>
          ) : (
            effectiveHostel
          )}{" "}
          · <TrustLine plume={l.seller.plume} ratedDeals={l.seller.ratedDeals} deals={false} />
        </div>
      </div>
    </article>
  );
}
