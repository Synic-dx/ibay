"use client";
/**
 * FEATURE: USP Navigation Chips (Rentals, Auctions, Food Drops)
 * WHAT: Dedicated visual icons and navigation chips for i-bay's 3 primary USPs.
 *       Strictly bespoke SVGs — NO emojis.
 */
import Link from "@/components/ui/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";

export function RentalUspIcon({ className = "icon i16" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Top arc & arrow */}
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      {/* Bottom arc & arrow */}
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

export function AuctionUspIcon({ className = "icon i16" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Gavel head */}
      <path d="m14.5 5.5 4 4" />
      <path d="m11.5 2.5 7 7-2 2-7-7 2-2Z" />
      {/* Gavel handle */}
      <path d="m9.5 7.5-6 6a2.121 2.121 0 0 0 3 3l6-6" />
      {/* Strike sound block */}
      <path d="M2 21h8" />
      <path d="M14 17l2 2" />
    </svg>
  );
}

export function FoodDropUspIcon({ className = "icon i16" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Outer flame */}
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
      {/* Inner spark */}
      <path d="M12 18a2 2 0 0 0 2-2c0-1.2-.8-1.8-1.4-2.5-.5.8-.6 1.4-.6 1.9a1.5 1.5 0 0 0 0 .6Z" fill="currentColor" stroke="none" opacity={0.85} />
    </svg>
  );
}

export function UspNavChips() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const isRentOn = pathname === "/browse" && sp.get("modes") === "rent";
  const isAuctionOn = pathname === "/browse" && sp.get("modes") === "auction";
  const isDropOn = pathname === "/browse" && (sp.get("cat") === "food" || sp.get("modes") === "drop");

  return (
    <div className="dusp-group" role="group" aria-label="Campus Marketplace USPs">
      <Link
        href="/browse?modes=rent"
        className={`dusp-chip rent ${isRentOn ? "on" : ""}`}
        title="Campus rentals: coolers, suits, cycles & calculators"
      >
        <RentalUspIcon className="icon i16 dusp-ic" />
        <span>Rentals</span>
      </Link>

      <Link
        href="/browse?modes=auction"
        className={`dusp-chip auction ${isAuctionOn ? "on" : ""}`}
        title="Live campus auctions: highest bid wins"
      >
        <AuctionUspIcon className="icon i16 dusp-ic" />
        <span>Auctions</span>
        <span className="usp-dot-pulse" aria-hidden="true" />
      </Link>

      <Link
        href="/browse?cat=food"
        className={`dusp-chip drop ${isDropOn ? "on" : ""}`}
        title="Hostel food drops: late night & flash food shares"
      >
        <FoodDropUspIcon className="icon i16 dusp-ic" />
        <span>Food drops</span>
      </Link>
    </div>
  );
}
