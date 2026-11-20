"use client";
/**
 * FEATURE: Instant Search Autocomplete & Recent Searches Dropdown
 * WHAT: Provides instant category suggestions, popular campus searches,
 *       and local recent search history with zero latency.
 */
import React, { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import type { Category } from "@/features/shell/queries";

export const RECENT_SEARCHES_KEY = "ibay:recent-searches";

type Props = {
  query: string;
  open: boolean;
  categories: Category[];
  recentSearches?: string[];
  onSelect: (value: string, categoryId?: string) => void;
  onClearRecent?: () => void;
  onClose: () => void;
};

export function SearchAutocomplete({
  query,
  open,
  categories,
  recentSearches = [],
  onSelect,
  onClearRecent,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matchingCategories = q
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.short.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q)
      )
    : [];

  const POPULAR_SEARCHES = ["Casio Calculator", "Formal Suit", "Air Cooler", "Bicycle", "Gym Whey"];

  return (
    <div className="dsearch-dropdown" ref={containerRef} role="listbox" aria-label="Search suggestions">
      {q ? (
        <>
          {matchingCategories.length > 0 && (
            <div className="dsearch-sec">
              <span className="dsearch-sec-title">
                <Icon name="grid" className="icon i14" />
                Categories
              </span>
              <div className="dsearch-items">
                {matchingCategories.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="dsearch-item"
                    onClick={() => onSelect(c.name, c.id)}
                  >
                    <Icon name={c.icon} className="icon i16 dsearch-ic" />
                    <span>
                      <b>{c.name}</b> in {c.group}
                    </span>
                    <Icon name="arrow" className="icon i14 dsearch-arrow" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dsearch-sec">
            <span className="dsearch-sec-title">
              <Icon name="search" className="icon i14" />
              Search campus listings
            </span>
            <button
              type="button"
              className="dsearch-item highlight"
              onClick={() => onSelect(query)}
            >
              <Icon name="search" className="icon i16 dsearch-ic" />
              <span>
                Search for <b>&quot;{query}&quot;</b> across all categories
              </span>
              <Icon name="arrow" className="icon i14 dsearch-arrow" />
            </button>
          </div>
        </>
      ) : (
        <>
          {recentSearches.length > 0 && (
            <div className="dsearch-sec">
              <div className="between" style={{ padding: "0 6px 6px" }}>
                <span className="dsearch-sec-title" style={{ padding: 0 }}>
                  <Icon name="clock" className="icon i14" />
                  Recent Searches
                </span>
                {onClearRecent && (
                  <button
                    type="button"
                    className="faint xs"
                    onClick={onClearRecent}
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="dsearch-chips">
                {recentSearches.slice(0, 6).map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="dsearch-chip"
                    onClick={() => onSelect(term)}
                  >
                    <Icon name="clock" className="icon i12" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dsearch-sec">
            <span className="dsearch-sec-title">
              <Icon name="sparkles" className="icon i14" />
              Popular on Campus
            </span>
            <div className="dsearch-chips">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="dsearch-chip pop"
                  onClick={() => onSelect(term)}
                >
                  <Icon name="search" className="icon i12" />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
