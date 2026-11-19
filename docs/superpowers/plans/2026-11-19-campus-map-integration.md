# IIM Indore Campus Map Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the real IIM Indore 3D campus map and pedestrian pathfinder into ibay across browsing (`/map`), listing creation (`/sell`), item pages (`/item/[id]`), deal handovers (`/deals`), and chat negotiation.

**Architecture:** Port static OpenStreetMap-derived campus nodes, edges, landmarks, and boundary polygons from `ipm-portal`. Use client-side MapLibre GL for 100% free, zero-latency vector rendering with zero database query overhead. Extend Supabase schema with residence roster migration and coordinates/notes columns.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, MapLibre GL (`react-map-gl/maplibre`), Tailwind CSS, Vitest, Supabase Postgres.

**Spec:** [`docs/superpowers/specs/2026-11-19-campus-map-integration-design.md`](file:///Users/ujjwalharsh/.gemini/antigravity/scratch/ibay/docs/superpowers/specs/2026-11-19-campus-map-integration-design.md)

## Global Constraints
- Map rendering must be 100% free with no external paid API keys (MapLibre GL + open vector tiles + static campus GeoJSON).
- Never leak private room numbers or personal handover notes on public `/item/[id]` pages.
- Listings without custom coordinates must gracefully fallback to the centroid of their residence.
- Food drops must be visible and claimable by the seller's residence and adjacent residences within a ~250m walking radius.
- Every task must pass `npm run typecheck` and `npm run test` before committing.

## Review Focus
1. **Invalid/Out-of-Bounds Coordinates**: If coordinates outside campus boundary are passed, snap or clamp to the nearest valid campus residence.
2. **Day Scholar Fallback**: When viewing user is a `Day scholar` (no hostel), routes should originate from Main Gate (No. 1) instead of crashing.
3. **Privacy Leakage in API/SSR**: Ensure `pickup_note` is never sent in public listing cards or item detail JSON to non-buyers.
4. **Food Drop Cross-Cluster Protection**: Ensure students beyond the 250m proximity radius cannot see or claim restricted drops.
5. **Mobile Touch Scroll Trap**: Ensure full-screen `/map` doesn't trap page gestures or block navigation drawer on mobile viewports.

---

### Task 1: Static Campus Data Extraction & Residence Roster Migration

**Files:**
- Create: `src/features/map/data/campus-locations.json`
- Create: `src/features/map/data/campus-nodes.json`
- Create: `src/features/map/data/campus-edges.json`
- Create: `src/features/map/data/campus-outline.json`
- Create: `supabase/migrations/20261119000001_campus_map.sql`
- Modify: `src/lib/validation/auth.ts:1-25`
- Modify: `src/features/home/hostel-sheet.tsx`
- Modify: `src/features/profile/profile-form.tsx`
- Test: `src/features/map/__tests__/roster.test.ts`

**Interfaces:**
- Produces: `HOSTELS: readonly string[]` in `src/lib/validation/auth.ts` containing 28 campus residences + `Day scholar`.
- Produces: `campus-locations.json`, `campus-nodes.json`, `campus-edges.json`, `campus-outline.json`.

- [ ] **Step 1: Write the failing roster test**

Create `src/features/map/__tests__/roster.test.ts` asserting that `HOSTELS` contains `SR 01`, `SR 16A`, `SR 18`, `EPGP Hostel`, `DPM Residence`, `Day scholar` and that the Zod auth schema accepts them while rejecting old `Hostel 1`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/map/__tests__/roster.test.ts`  
Expected: FAIL with old hostel list mismatch.

- [ ] **Step 3: Extract static campus JSON data from `ipm-portal`**

Run node script to dump `campus_locations`, `campus_path_nodes`, `campus_path_edges`, and `IIMI_OUTLINE_GEOJSON` into `src/features/map/data/*.json`.

- [ ] **Step 4: Update `HOSTELS` and forms in `ibay`**

Update `src/lib/validation/auth.ts`, `src/features/home/hostel-sheet.tsx`, and `src/features/profile/profile-form.tsx` to use the 28 campus residences + `Day scholar`.

- [ ] **Step 5: Write the Supabase migration**

Create `supabase/migrations/20261119000001_campus_map.sql` altering `profiles_hostel` constraint, adding `pickup_lat`, `pickup_lng`, `pickup_note` to `listings`, and `handover_lat`, `handover_lng`, `handover_spot_name` to `transactions`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- src/features/map/__tests__/roster.test.ts` and `npm run typecheck`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/data/ supabase/migrations/ src/lib/validation/auth.ts src/features/home/hostel-sheet.tsx src/features/profile/profile-form.tsx src/features/map/__tests__/roster.test.ts
git commit -m "feat(map): extract campus dataset and migrate residence roster"
```

---

### Task 2: Core Map Utilities & Pathfinder (TDD)

**Files:**
- Create: `src/features/map/types.ts`
- Create: `src/features/map/pathfinder.ts`
- Create: `src/features/map/proximity.ts`
- Create: `src/features/map/midpoint.ts`
- Test: `src/features/map/__tests__/pathfinder.test.ts`
- Test: `src/features/map/__tests__/proximity.test.ts`
- Test: `src/features/map/__tests__/midpoint.test.ts`

**Interfaces:**
- Produces: `findCampusRoute(fromCoord: [number, number], toCoord: [number, number], avoidStairs?: boolean): NavigationRoute | null`
- Produces: `getNearbyResidences(residenceName: string, radiusMeters?: number): string[]`
- Produces: `getEquidistantLandmark(resA: string, resB: string): CampusLocation`

- [ ] **Step 1: Write failing tests for pathfinder, proximity, and midpoint**

Create test files verifying:
- `findCampusRoute` calculates valid route, distance in meters, step counts, and identifies stairs.
- `getNearbyResidences` returns adjacent residences within 250m for food drop proximity.
- `getEquidistantLandmark` returns neutral landmarks (e.g. SAC / Nescafe) for two distant hostels.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/features/map/__tests__/`  
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement `types.ts`, `pathfinder.ts`, `proximity.ts`, and `midpoint.ts`**

Port Dijkstra algorithm, distance calculation (`Haversine`), and bearing/turn logic using the static JSON graph nodes and edges from Task 1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/features/map/__tests__/`  
Expected: PASS with 100% tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/
git commit -m "feat(map): implement pathfinder, proximity radius, and midpoint algorithms"
```

---

### Task 3: MapLibre Client Component & Spot Picker in `/sell`

**Files:**
- Create: `src/features/map/components/campus-map.tsx`
- Create: `src/features/map/components/spot-picker.tsx`
- Create: `src/features/map/components/map.module.css`
- Modify: `src/features/listings/listing-form/listing-form.tsx:180-260`
- Modify: `src/lib/validation/listing.ts`
- Modify: `src/features/listings/actions/create.ts`
- Modify: `package.json`
- Test: `src/features/map/__tests__/spot-picker.test.ts`

**Interfaces:**
- Consumes: `campus-locations.json`, `campus-outline.json` from Task 1.
- Produces: `<CampusMap />`, `<SpotPicker value={coord} onChange={setCoord} note={note} onNoteChange={setNote} />`
- Produces: `listingSchema` accepting optional `pickupLat`, `pickupLng`, `pickupNote`.

- [ ] **Step 1: Install maplibre-gl and react-map-gl**

Run: `npm install maplibre-gl@^5.1.0 react-map-gl@^8.0.1`

- [ ] **Step 2: Write failing test for listing schema with coordinates and note**

Create test verifying `listingSchema` parses valid coordinates, rejects non-numeric or out-of-bounds coordinates, and bounds `pickupNote` to max 300 characters.

- [ ] **Step 3: Update `listing.ts` and `create.ts`**

Add `pickupLat: z.number().optional()`, `pickupLng: z.number().optional()`, `pickupNote: z.string().max(300).optional()` to `listingSchema` and propagate into database insert.

- [ ] **Step 4: Implement `<CampusMap />` and `<SpotPicker />`**

Build MapLibre wrapper with IIMI bounds (`CAMPUS_BOUNDS`), polygon outline layer, click-to-drop pin, and residence snap buttons. Add the optional private handover note input field.

- [ ] **Step 5: Integrate into `listing-form.tsx`**

Embed `<SpotPicker />` into Step 1 of the listing form with responsive collapsible view.

- [ ] **Step 6: Verify with typecheck and tests**

Run: `npm run typecheck && npm run test`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/ src/features/listings/ src/lib/validation/listing.ts package.json package-lock.json
git commit -m "feat(map): add MapLibre component and spot picker in sell form"
```

---

### Task 4: Item Page Pickup Snippet & Deals Private Handover Card

**Files:**
- Create: `src/features/map/components/pickup-snippet.tsx`
- Create: `src/features/map/components/handover-card.tsx`
- Modify: `src/app/(shop)/item/[id]/page.tsx:80-140`
- Modify: `src/features/deals/deals-view.tsx:50-120`
- Modify: `src/features/deals/stages.ts`
- Test: `src/features/map/__tests__/handover-privacy.test.ts`

**Interfaces:**
- Consumes: `findCampusRoute` from Task 2.
- Produces: `<PickupSnippet residence={l.pickupHostel} viewerHostel={viewer?.hostel} />` (No private note shown).
- Produces: `<HandoverCard deal={deal} viewerId={viewer.id} />` (Private note securely revealed to buyer/seller).

- [ ] **Step 1: Write failing privacy and routing test**

Test verifying that public item mapper does NOT leak `pickup_note` to unauthenticated or non-buyer users, and that `HandoverCard` renders the note only when `viewer.id` is part of the transaction.

- [ ] **Step 2: Implement `<PickupSnippet />` and attach to `/item/[id]`**

Render campus mini-map showing residence pin, walking duration, step count, and flat route / stairs badge from viewer's declared hostel.

- [ ] **Step 3: Implement `<HandoverCard />` and attach to `/deals`**

Render active deal handover section with exact meeting pin, seller's private note (*"Room 204..."*), and interactive *"Walk there"* routing sheet.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run typecheck && npm run test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/ src/app/(shop)/item/[id]/page.tsx src/features/deals/
git commit -m "feat(map): add item pickup preview and secure deals handover card"
```

---

### Task 5: Full-Screen Campus Map Tab (`/map`) & Shell Navigation

**Files:**
- Create: `src/app/(shop)/map/page.tsx`
- Create: `src/features/map/components/campus-browse-map.tsx`
- Create: `src/features/map/components/map-drawer.tsx`
- Modify: `src/features/listings/queries.ts:40-90`
- Modify: `src/components/shell/mobile-bars.tsx:70-110`
- Modify: `src/components/shell/desktop-header.tsx:40-90`
- Test: `src/features/map/__tests__/food-drops-proximity.test.ts`

**Interfaces:**
- Consumes: `getNearbyResidences` from Task 2.
- Produces: `/map` page rendering all active listings by residence cluster.
- Produces: Updated `visibleCatalogue` including food drops from nearby cluster hostels (~250m radius).

- [ ] **Step 1: Write failing test for food drops proximity query**

Test verifying that a user in `SR 18` can see food drops from adjacent `SR 17` and `SR 20` (~250m radius), but not from distant `SR 01`.

- [ ] **Step 2: Update `canSeeDrop` in `src/features/listings/queries.ts`**

Use `getNearbyResidences` so food drops are visible to students within the same hostel cluster.

- [ ] **Step 3: Implement `<CampusBrowseMap />` and `<MapDrawer />`**

Build full-screen map with category filter pills (*All*, *Food Drops*, *Rentals*, *For Sale*), cluster badges on residences with item counts, and bottom slide-up drawer for items when a residence is tapped.

- [ ] **Step 4: Add Map Navigation Icon to `TabBar` and `DesktopHeader`**

Add map icon link `/map` to mobile bottom bar and desktop header navigation.

- [ ] **Step 5: Verify route, tests, and typecheck**

Run: `npm run typecheck && npm run test`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(shop)/map/ src/features/map/components/ src/features/listings/queries.ts src/components/shell/
git commit -m "feat(map): add full-screen /map browse tab with cluster drawer and shell links"
```

---

### Task 6: Chat "Meet Halfway" Coordination Widget

**Files:**
- Create: `src/features/map/components/meet-halfway-picker.tsx`
- Modify: `src/features/chat/thread-view.tsx:100-160`
- Modify: `src/features/deals/actions.ts:40-60`
- Test: `src/features/map/__tests__/chat-halfway.test.ts`

**Interfaces:**
- Consumes: `getEquidistantLandmark` from Task 2.
- Produces: Server action `updateHandoverSpot(txId: string, spotName: string, lat: number, lng: number): Promise<ActionResult>`
- Produces: `<MeetHalfwayPicker />` inside chat thread view.

- [ ] **Step 1: Write failing test for handover spot update**

Test verifying `updateHandoverSpot` server action updates `handover_lat`, `handover_lng`, and `handover_spot_name` in transaction and verifies actor permissions.

- [ ] **Step 2: Implement `updateHandoverSpot` action**

Add action in `src/features/deals/actions.ts` updating transaction meeting coordinates with notification.

- [ ] **Step 3: Implement `<MeetHalfwayPicker />` in `thread-view.tsx`**

When buyer and seller are from different residences, display auto-suggested central landmark chip (*e.g., Nescafe Courtyard*) with "Agree on spot" or "Pick other" action buttons.

- [ ] **Step 4: Run full project test suite and typecheck**

Run: `npm run typecheck && npm run test`  
Expected: All tests pass cleanly, 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/ src/features/deals/actions.ts src/features/map/components/
git commit -m "feat(map): add chat meet-halfway coordination widget and actions"
```
