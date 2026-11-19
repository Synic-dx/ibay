"use client";
/**
 * FEATURE: Fullscreen Image Lightbox
 * WHAT: Clean, distraction-free lightbox for inspecting listing photos in high resolution.
 *       Supports keyboard navigation (Escape, Left, Right arrows) and backdrop dismissal.
 */
import React, { useEffect } from "react";
import { Icon } from "@/components/ui/icon";

type Props = {
  open: boolean;
  images: string[];
  currentIndex: number;
  alt?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function Lightbox({
  open,
  images,
  currentIndex,
  alt = "Product photo",
  onClose,
  onIndexChange,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        onIndexChange((currentIndex - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        onIndexChange((currentIndex + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, images.length, onClose, onIndexChange]);

  if (!open || !images.length) return null;

  const current = images[currentIndex] || images[0];

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen photo viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-topbar">
        <span className="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          type="button"
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close photo viewer"
        >
          <Icon name="x" className="icon i20" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className="lightbox-viewport">
        {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox high-res preview */}
        <img src={current} alt={alt} className="lightbox-img" />
      </div>

      {images.length > 1 && (
        <div className="lightbox-nav">
          <button
            type="button"
            className="lightbox-nav-btn prev"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((currentIndex - 1 + images.length) % images.length);
            }}
            aria-label="Previous photo"
          >
            <Icon name="back" className="icon i20" />
          </button>
          <button
            type="button"
            className="lightbox-nav-btn next"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((currentIndex + 1) % images.length);
            }}
            aria-label="Next photo"
          >
            <Icon name="arrow" className="icon i20" />
          </button>
        </div>
      )}
    </div>
  );
}
