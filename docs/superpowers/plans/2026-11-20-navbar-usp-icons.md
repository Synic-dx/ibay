# Implementation Plan: Navigation Bar USP Visual Icons (Rentals, Auctions, Food Drops)

**Status:** Proposed  
**Author:** Antigravity  
**Date:** 2026-11-20  
**Target:** Elevate i-bay's top navigation category strip with dedicated visual icons and distinctive styling for the 3 core USPs (Rentals, Auctions, Food Drops).

---

## 1. Problem Statement & Motivation

In the current desktop navigation bar:
1. **Rentals** (`modes=rent`) is missing entirely from the top category strip (only buried inside the "All categories" mega dropdown).
2. **Food drops** (`modes=drop` / `cat=food`) is rendered as a plain text link (`Food drops`) mixed between "Appliances" and "Free" with no visual distinction or icon.
3. **Auctions** (`modes=auction`) is appended at the very end with a standard monochrome icon (`hammer`), lacking prominence or live indicators.
4. As confirmed by the user, **Rentals, Auctions, and Food Drops are the primary USPs (Unique Selling Propositions)** that set i-bay apart from ordinary classifieds. They must stand out with dedicated, premium visual icons and bespoke styling.

---

## 2. Proposed Design & UX Architecture

### 2.1 Navigation Bar Placement & Visual Hierarchy

We introduce a dedicated **USP Group** positioned immediately next to the `All categories` mega-menu trigger, followed by an elegant vertical divider before the standard product categories:

```
+-----------------------------------------------------------------------------------------------------------------------------+
| [㗊 All categories ▾] | [ 🔄 Rentals ] [ 🔨 Auctions ● ] [ 🔥 Food drops ] |  Gym Corner  Books  CFA & CAT  Manga  Appliances ... |
+-----------------------------------------------------------------------------------------------------------------------------+
```

#### Why this layout is superior:
- **Instant Discovery:** Anyone visiting the homepage or any shop page immediately sees the 3 campus marketplace USPs without horizontal scrolling.
- **Cognitive Clarity:** Separates *Transaction Modes / USPs* (Rent, Bid, Snag Food) from *Product Types* (Books, Gym, Electronics).
- **Sticky Prominence:** Positioned on the left side of the category bar, remaining visible across all desktop screen sizes (1080px to 4K).

---

### 2.2 Visual Icon & Styling Specs for Each USP

| USP | Route | Visual Icon & Details | Accent Colors (Light / Dark) | Special Indicator |
| :--- | :--- | :--- | :--- | :--- |
| **Rentals** | `/browse?modes=rent` | **Dual-Arrow Loop with Key/Clock motif** (`RentalIcon`) — clean circular flow showing peer-to-peer sharing. | Mint/Teal: `var(--brand-soft)` bg, `var(--brand-ink)` text & icon | Micro-chip: "Save 80%" or subtle icon badge |
| **Auctions** | `/browse?modes=auction` | **Angled Gavel on Strike Plate** (`AuctionIcon`) — dynamic tilt with crisp strike accents. | Amber/Gold: `var(--warn-soft)` bg, `var(--warn-ink)` text & icon | **Live Pulse Dot**: Pulsing amber dot indicator (`.usp-dot-pulse`) |
| **Food drops** | `/browse?cat=food` (also matches `modes=drop`) | **Express Flame** (`FoodDropIcon`) — vibrant flame silhouette with dual-tone inner flicker. | Coral/Flame: `var(--bad-soft)` bg, `var(--bad)` text & icon | **Hot Flame Accent**: Express tag badge |

---

### 2.3 Micro-interactions & States
- **Idle State:** Soft-tinted background pill (`rgba` / token soft background), crisp 13px font weight 600, 16px SVG icon with brand accent.
- **Hover State:** Subtle lift (`transform: translateY(-1px)`), slight elevation shadow (`box-shadow: var(--shr)`), saturated icon color.
- **Active State (`.on`):** When the user is currently filtering by that mode (e.g. `/browse?modes=rent`), the pill becomes solid/accent-highlighted with `box-shadow: inset 0 0 0 1.5px currentColor`.
- **Theme Adaptability:** Full integration with `[data-theme=dark]`, maintaining WCAG AAA contrast against `--surface` and `--brand`.

---

## 3. Implementation Breakdown

### Task 1: Create Dedicated USP Icons & Helper Component
- **Files:** `src/components/shell/usp-icons.tsx`
- **Details:**
  - Export 3 custom, high-precision SVG icons tailored for crisp rendering at 16x16 and 18x18 viewports:
    1. `RentalUspIcon`: Circular cycling arrows with rounded caps and center tick.
    2. `AuctionUspIcon`: Dynamic gavel angled at 45° with strike platform.
    3. `FoodDropUspIcon`: Fluid flame silhouette with inner thermal core.
  - Export a shared `UspChip` component that handles active route detection (`pathname` + `searchParams`), keyboard focus, hover effects, and accessible aria-labels.

### Task 2: Update Desktop Header Navigation Strip
- **Files:** `src/components/shell/desktop-header.tsx`
- **Details:**
  - Extract `Rentals`, `Auctions`, and `Food drops` from the standard `QUICK` array into the dedicated USP cluster.
  - Position the USP cluster immediately after `.dmega` (`All categories`) and before `.dscroll` with a subtle divider (`.dusp-div`).
  - Keep standard categories (`Gym Corner`, `Books`, `CFA & CAT`, etc.) in `.dscroll` for smooth horizontal navigation.
  - Implement precise active route checking:
    - Rentals: `pathname === "/browse" && sp.get("modes") === "rent"`
    - Auctions: `pathname === "/browse" && sp.get("modes") === "auction"`
    - Food drops: `pathname === "/browse" && (sp.get("cat") === "food" || sp.get("modes") === "drop")`

### Task 3: CSS Styling & Token Integration
- **Files:** `src/styles/ibay.css` and `src/styles/app.css`
- **Details:**
  - Define styles for `.dusp-group`, `.dusp-chip`, `.dusp-chip.rent`, `.dusp-chip.auction`, `.dusp-chip.drop`, and `.dusp-div`.
  - Add pulse animation for the live auction indicator (`@keyframes uspPulse`).
  - Ensure zero layout shift and smooth responsive behavior above `1080px`.

### Task 4: Drawer & Mobile Consistency Check
- **Files:** `src/components/shell/drawer.tsx` (Mobile slide-out menu)
- **Details:**
  - Ensure the mobile drawer also displays the new USP visual icons for consistency across devices.

### Task 5: Verification & Tests
- **Unit Testing:** Add tests in `src/components/shell/__tests__/desktop-header-usps.test.tsx` verifying:
  - Presence of all 3 USP chips with their respective hrefs (`/browse?modes=rent`, `/browse?modes=auction`, `/browse?cat=food`).
  - Active class application when corresponding searchParams are present.
- **Type Checking:** `npm run typecheck` (0 errors).
- **Automated Tests:** `npm run test` (all 18 test files pass).
- **Production Build:** `npm run build` compiles with zero warnings.
- **Visual Capture:** Test on Chrome (1440px desktop & 1280px laptop viewports) to verify spacing, contrast, and alignment.
