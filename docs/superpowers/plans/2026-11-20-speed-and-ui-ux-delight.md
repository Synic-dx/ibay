# Implementation Plan: Comprehensive Speed & UI/UX Delight Upgrades

**Target:** Elevate i-bay's speed, smoothness, search experience, and micro-interactions across desktop and mobile.  
**Author:** Antigravity  
**Date:** 2026-11-20  

---

## 1. Overview & Architecture

This plan executes the 5 high-impact performance and UI/UX pillars:
1. **Speed & Data Caching:**
   - Raw active catalogue caching via `unstable_cache` with tag `listings` (drops TTFB to ~10ms).
   - LCP hero image prioritization (`fetchPriority="high"` and `loading="eager"`).
   - Hardware-accelerated 60/120fps scrolling with zero layout shift.
2. **Instant Search Autocomplete & Recent Searches:**
   - Live dropdown in desktop header with matching categories, quick listing results, and `localStorage` recent searches.
3. **Card Micro-interactions & Zero-CLS Skeletons:**
   - Photo hover zoom (`scale(1.03)` with smooth cubic-bezier easing).
   - Wishlist heart pop keyframe animation (`@keyframes heartPop`).
   - Skeleton shimmer geometry matching.
4. **Item Detail Lightbox & Share Polish:**
   - High-res full-screen image lightbox modal on photo click with close and arrow navigation.
   - Prominent quick-share action with native Web Share / clipboard toast.
5. **Dark Mode & Contrast Calibration:**
   - Deep OLED contrast tuning for borders, cards, and modal sheets.

---

## 2. Tasks Breakdown

### Task 1: Catalogue Server Caching & LCP Image Prioritization
- **Files:** `src/features/listings/queries.ts`, `src/features/home/hero.tsx`, `src/styles/ibay.css`
- **Actions:**
  - Wrap raw active listings query in `unstable_cache` with tag `['listings']` and 30s revalidation.
  - Set `fetchPriority="high"` on the first slide image of the hero carousel.
  - Add hardware acceleration (`transform: translateZ(0)`) and `content-visibility: auto` to grids and rails.
- **Verification:** Unit tests pass, page load TTFB measured.

### Task 2: Instant Search Autocomplete & Recent Searches
- **Files:** `src/components/shell/search-autocomplete.tsx`, `src/components/shell/desktop-header.tsx`, `src/styles/app.css`
- **Actions:**
  - Build `SearchAutocomplete` component with debounced (~150ms) matching.
  - Support category suggestions, listing suggestions, and recent searches in `localStorage`.
  - Wire keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`) and click-outside dismissal.
- **Verification:** Unit tests for search suggestions and keyboard accessibility.

### Task 3: Card Micro-Interactions & Skeletons
- **Files:** `src/styles/ibay.css`, `src/styles/app.css`, `src/features/listings/components/product-card.tsx`
- **Actions:**
  - Add `@keyframes heartPop` on heart button click.
  - Add smooth image zoom on card hover.
  - Ensure card skeleton geometry matches exactly.
- **Verification:** Test heart button click animation and skeleton styling.

### Task 4: Item Detail Lightbox Modal & Quick Share
- **Files:** `src/features/item/item-view.tsx`, `src/styles/app.css`
- **Actions:**
  - Add click-to-lightbox state on the image gallery.
  - Display full-screen overlay with image zoom, previous/next controls, keyboard navigation, and close button.
  - Verify share button feedback.
- **Verification:** Unit test for lightbox toggle and image index navigation.

### Task 5: Dark Mode & Contrast Calibration
- **Files:** `src/styles/ibay.css`, `src/styles/app.css`
- **Actions:**
  - Calibrate `--surface`, `--surface-2`, `--line`, and glass edge contrast on dark theme.
- **Verification:** Visual check on dark theme mode.

---

## 3. Verification & Quality Gates
- TypeScript: `npm run typecheck` (0 errors)
- Unit tests: `npm run test` (all tests passing)
- Production build: `npm run build` (0 errors)
