# Design Doc: IIM Indore Campus Map Integration

**Date:** 2026-11-19  
**Status:** Approved  
**Target:** `src/features/map/*`, `src/app/(shop)/map/page.tsx`, `src/features/listings/listing-form/listing-form.tsx`, `src/app/(shop)/item/[id]/page.tsx`, `src/features/deals/*`, `src/features/chat/*`, `src/components/shell/*`, `supabase/migrations/*`, `src/lib/validation/auth.ts`

---

## 1. Intent & The Why
**ibay** is an exclusive campus marketplace for IIM Indore students. All transactions are settled offline at physical handover (*"Pay at handover - UPI or cash when you meet"*). 

Because IIM Indore's hill campus (*Prabandh Shikhar*) features steep topography, stairs, and 28 student residences (`SR 01`–`SR 20`, `EPGP`, `DPM`, etc.), coordinating physical handovers causes friction (confusion over exact pickup spots, negotiating who walks up the hill, and difficulty discovering items nearby).

By integrating the real-world **IIM Indore Campus Map** and pathfinding graph from `ipm-portal`, this project eliminates handover friction and turns the marketplace into an interactive visual campus experience.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Real IIM Indore Campus Roster Migration**:
   - Retire the old placeholder `Hostel 1`–`Hostel 6` values.
   - Adopt the official campus residence roster: `SR 01` through `SR 20` (including `SR 16A`, `SR 16B`), `EPGP Hostel`, `DPM Residence`, `Executive Residence 01`–`04`, `Married Residence 01`, and `Day scholar`.
   - Update database CHECK constraints (`profiles_hostel`), auth schemas, onboarding, and profile forms.
2. **Dedicated Full-Screen Campus Map Tab (`/map`)**:
   - Visual discovery of campus inventory.
   - Filter pills: *All*, *Food Drops* (with live countdown rings), *Rentals*, and *For Sale*.
   - Cluster badges on residences showing available item counts.
   - Tapping a hostel pin opens a bottom drawer/sheet with product cards.
3. **Interactive Handover Spot Picker & Private Note in `/sell`**:
   - Sellers can pinpoint an exact pickup location on the interactive campus map (or snap to their residence).
   - An optional **Handover Note** field (*e.g., "Room 204, knock or text", "Ground floor near the TT table"*).
4. **Item Page Pickup Snippet (`/item/[id]`)**:
   - Displays a mini-map preview of the general pickup location/residence.
   - Shows walking distance and estimated step count from the viewing student's hostel (*e.g., "5 min walk from SR 03 · 340 steps · Flat route available"*).
5. **Private Handover Note on Order Confirmation (`/deals`)**:
   - On the confirmed deal card, the seller's handover note (*"Room 204..."*) is securely revealed to the confirmed buyer alongside exact meeting coordinates and a *"Walk there"* pathfinder route.
6. **Radius-Based Nearby Food Drops**:
   - In addition to the exact same residence, food drops are visible and claimable by students in nearby adjacent residences within walking proximity (~250m cluster radius).
7. **Chat "Meet Halfway" Coordination Widget**:
   - Suggests central neutral campus landmarks (*SAC, Nescafe, Pi Shop, Central Library Steps, Sports Complex*).
   - One-tap "Propose Meeting Spot" and "Accept Spot" buttons that update the deal's agreed handover location.

### Non-Goals
- Real-time GPS vehicle tracking or live delivery fleet tracking.
- Reliance on paid external map services (Google Maps API / Mapbox tokens); the implementation uses 100% free **MapLibre GL** with open vector tiles and self-contained IIMI GeoJSON data.
- Enforcing mandatory GPS permissions; students without GPS can view routes from their declared hostel.

### Anti-Goals
- **Zero Privacy Leakage**: Never expose private room numbers or personal handover notes on public `/item/[id]` pages. The handover note is strictly restricted to confirmed transaction parties.
- Never break existing listings that lack exact coordinates: listings without custom coordinates gracefully fall back to the centroid of their residence.

---

## 3. Approaches Considered

### Approach A: Two-Stage Rollout
- Phase 1: Transactional core only.
- Phase 2: Fullscreen `/map` page and chat meet-halfway.
- *Discarded per user selection.*

### Approach B: Full Suite Integrated Release (Approved)
- Build and verify all touchpoints together on branch `ujjwal/campus-map`.

---

## 4. Technical Architecture & Component Structure

### A. Database Schema Migration (`supabase/migrations/20261119000001_campus_map.sql`)
1. **Residence Roster Migration**:
   - Update `profiles` check constraint:
     `CHECK (hostel IN ('SR 01', 'SR 02', 'SR 03', 'SR 04', 'SR 05', 'SR 06', 'SR 07', 'SR 08', 'SR 09', 'SR 10', 'SR 11', 'SR 12', 'SR 13', 'SR 14', 'SR 15', 'SR 16A', 'SR 16B', 'SR 17', 'SR 18', 'SR 19', 'SR 20', 'EPGP Hostel', 'DPM Residence', 'Executive Residence 01', 'Executive Residence 02', 'Executive Residence 03', 'Executive Residence 04', 'Married Residence 01', 'Day scholar'))`
   - Map any existing test user profiles from `Hostel 1`–`Hostel 6` to `SR 01`–`SR 06`.
2. **`listings` Table Extensions**:
   - `pickup_lat`: `NUMERIC(10, 7) NULL`
   - `pickup_lng`: `NUMERIC(10, 7) NULL`
   - `pickup_note`: `TEXT NULL`
3. **`transactions` Table Extensions**:
   - `handover_lat`: `NUMERIC(10, 7) NULL`
   - `handover_lng`: `NUMERIC(10, 7) NULL`
   - `handover_spot_name`: `TEXT NULL`
   - `handover_agreed_at`: `TIMESTAMPTZ NULL`

### B. Core Map Engine & Static Campus Data (`src/features/map/*`)
- `data/campus-locations.json`: Full static snapshot of all 99 campus landmarks (28 residences + 71 amenities/eateries/sports/academics) extracted from `ipm-portal`.
- `data/campus-nodes.json`: Static routing graph nodes.
- `data/campus-edges.json`: Static routing graph edges with distance, step counts, and stair tags.
- `data/campus-outline.json`: IIM Indore campus geofence boundary polygon.
- `campus-map.tsx`: MapLibre GL wrapper with IIMI bounds, polygon mask, 2D/3D tilt toggle, and custom marker rendering.
- `pathfinder.ts`: Graph-based Dijkstra router supporting step counts, distance, and stair-avoiding routes.
- `proximity.ts`: Computes walking radius / nearby hostel clusters for Food Drops.
- `midpoint.ts`: Calculates the optimal equidistant landmark between two hostels.

### C. UI Integration Points
1. **`/map` Route (`src/app/(shop)/map/page.tsx`)**:
   - Fullscreen interactive campus map with search bar and filter chips.
   - Dynamic marker clusters for residences and glowing radars for food drops.
   - Bottom slide-up drawer for hostel item listings.
   - Added to `TabBar` (bottom navigation on mobile) and `DesktopHeader`.
2. **Listing Form (`src/features/listings/listing-form/listing-form.tsx`)**:
   - In Step 1, `<SpotPicker />` allows tapping to place a pin or snapping to the selected residence.
   - Optional `<input name="pickupNote" placeholder="e.g. Room 204, or near the water cooler" />` (labeled: *Visible to confirmed buyers only*).
3. **Item Page (`src/app/(shop)/item/[id]/page.tsx`)**:
   - `<PickupSnippet />` displaying hostel pin and walking route badge. (Handover note omitted).
4. **Deals View (`src/features/deals/deals-view.tsx`)**:
   - `<HandoverCard />` with seller's handover note, turn-by-turn directions, and stair warnings.
5. **Chat Thread (`src/features/chat/thread-view.tsx`)**:
   - "Meet Halfway" landmark suggestions and handover spot confirmation in messages.


---

## 1. Intent & The Why
**ibay** is an exclusive campus marketplace for IIM Indore students. Unlike a standard e-commerce platform, all transactions are settled offline at physical handover (*"Pay at handover - UPI or cash when you meet"*). 

Because IIM Indore's campus (*Prabandh Shikhar*) is hilly with steep elevation, stairs, and 18+ scattered hostels, coordinating physical handovers causes friction (confusion over exact pickup spots, negotiating who walks up the hill, and difficulty locating items nearby).

By porting and integrating the battle-tested **IIM Indore Campus Map** from `ipm-portal`, this project eliminates handover friction and turns the marketplace into an interactive visual campus experience.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Dedicated Full-Screen Campus Map Tab (`/map`)**:
   - Visual discovery of campus inventory.
   - Filter pills: *All*, *Food Drops* (with live countdown rings), *Rentals*, and *For Sale*.
   - Cluster badges on hostels showing available item counts.
   - Tapping a hostel pin opens a bottom drawer/sheet with product cards.
2. **Interactive Handover Spot Picker & Note in `/sell`**:
   - Sellers can pinpoint an exact pickup location on the interactive campus map (or snap to their hostel).
   - An optional **Handover Note** field (*e.g., "Room 204, knock or text", "Ground floor near the TT table"*).
3. **Item Page Pickup Snippet (`/item/[id]`)**:
   - Displays a mini-map preview of the pickup location.
   - Shows walking distance and estimated step count from the viewing student's hostel (*e.g., "5 min walk from Hostel 3 · 340 steps · Flat route available"*).
   - Displays the seller's handover note.
4. **Order Confirmation & Handover Card (`/deals`)**:
   - On the active deal card, a dedicated handover section shows the exact meeting pin, the seller's note, and a *"Walk there"* button that calculates the campus route with stair alerts.
5. **Chat "Meet Halfway" Coordination Widget**:
   - When a buyer and seller in different hostels chat, ibay suggests central neutral campus landmarks (*e.g., SAC Courtyard, Nescafe, Pi Shop, Central Library Steps*).
   - One-tap "Propose Meeting Spot" and "Accept Spot" buttons that update the deal's agreed handover location.

### Non-Goals
- Real-time GPS vehicle tracking or live delivery fleet tracking (all handovers are peer-to-peer student walks).
- Reliance on paid external map services (Google Maps API / Mapbox tokens); the implementation uses 100% free **MapLibre GL** with open vector tiles and self-contained IIMI GeoJSON data.
- Enforcing mandatory GPS permissions; students without GPS can view routes from their declared hostel.

### Anti-Goals
- Never break existing listings that lack exact coordinates: listings without custom coordinates gracefully fall back to the centroid of their `pickupHostel`.
- Never expose private room numbers publicly if the seller prefers not to share them; the handover note is clearly labeled as visible to confirmed buyers or public as per the seller's choice.

---

## 3. Approaches Considered

### Approach A: Two-Stage Rollout
- Phase 1: Transactional core only (Sell picker, item snippet, deal card).
- Phase 2: Fullscreen `/map` page and chat meet-halfway.
- *Pros:* Smaller initial blast radius.
- *Cons:* Leaves the marketplace without the primary visual discovery tab until phase 2.

### Approach B: Full Suite Integrated Release (Selected by User)
- Build and verify all 5 touchpoints together in one cohesive release on branch `ujjwal/campus-map`.
- *Pros:* Complete end-to-end user journey (Browse on Map → View Item → Negotiate Meet Halfway in Chat → Agree on Deal with Handover Directions).
- *Cons:* Larger scope requiring rigorous step-by-step verification.

---

## 4. Technical Architecture & Component Structure

### A. Database Schema (`supabase/migrations/20261119000001_campus_map.sql`)
1. **`listings` Table Extensions**:
   - `pickup_lat`: `NUMERIC(10, 7) NULL`
   - `pickup_lng`: `NUMERIC(10, 7) NULL`
   - `pickup_note`: `TEXT NULL`
2. **`transactions` Table Extensions**:
   - `handover_lat`: `NUMERIC(10, 7) NULL`
   - `handover_lng`: `NUMERIC(10, 7) NULL`
   - `handover_spot_name`: `TEXT NULL`
   - `handover_agreed_at`: `TIMESTAMPTZ NULL`

### B. Core Map Engine & Utilities (`src/features/map/*`)
- `campus-map.tsx`: Reusable MapLibre GL component with IIMI geofencing boundary polygon, 2D/3D tilt toggle, and custom marker rendering.
- `geofence.ts`: Ported from `ipm-portal` containing `IIMI_OUTLINE_GEOJSON`, `CAMPUS_CENTER_COORDS` (`[75.7906, 22.6262]`), and `CAMPUS_BOUNDS`.
- `landmarks.ts`: Reference coordinates for all 18+ hostels, academic blocks, messes, SAC, Nescafe, Sports Complex, etc.
- `pathfinder.ts`: Ported graph-based Dijkstra router with `CampusPathNode` and `CampusPathEdge` supporting step counts, distance, and stair-avoiding routes.
- `midpoint.ts`: Calculates the optimal equidistant landmark between two hostels.

### C. UI Integration Points
1. **`/map` Route (`src/app/(shop)/map/page.tsx`)**:
   - Fullscreen interactive campus map with search bar and filter chips.
   - Dynamic marker clusters for hostels and glowing radars for food drops.
   - Bottom slide-up drawer for hostel item listings.
   - Added to `TabBar` (bottom navigation on mobile) and `DesktopHeader`.
2. **Listing Form (`src/features/listings/listing-form/listing-form.tsx`)**:
   - In Step 1/3, a collapsible `<SpotPicker />` allows tapping to place a pin or snapping to the selected hostel.
   - An optional `<input name="pickupNote" placeholder="e.g. Room 204, or near the water cooler" />`.
3. **Item Page (`src/app/(shop)/item/[id]/page.tsx`)**:
   - A `<PickupSnippet />` displaying hostel pin, seller note, and walking route badge.
4. **Deals View (`src/features/deals/deals-view.tsx`)**:
   - `<HandoverCard />` with turn-by-turn directions and stair warnings.
5. **Chat Thread (`src/features/chat/thread-view.tsx`)**:
   - Propose and accept meeting spot action in messages.

---

## 5. What is Left to the Builder
- Detailed styling of the MapLibre popups to match ibay's peacock/teal theme (`#02505F`, `#1FC9B2`, `#E0A526`).
- Adding automated tests in Vitest for `midpoint.ts`, `pathfinder.ts`, and Zod validation of `pickup_lat` / `pickup_lng`.
- Mobile drawer gesture/touch responsiveness.
