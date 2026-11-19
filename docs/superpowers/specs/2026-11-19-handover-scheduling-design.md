# Design Doc: Campus Handover Scheduling & Availability Coordination

**Date:** 2026-11-19  
**Status:** Approved  
**Target:** `src/features/deals/*`, `src/features/listings/*`, `src/features/chat/*`, `supabase/migrations/20261119000002_handover_scheduling.sql`

---

## 1. Intent & Context
In **i-bay**, all exchanges are settled in-person on the IIM Indore campus (*"Pay at handover — UPI or cash"*). While our 3D map system provides spatial precision (exact meeting pins, Dijkstra walkway routes), student schedules fluctuate constantly due to lectures, group study, submissions, and mess timings.

Currently:
- The `/sell` form has no structured way for sellers to state their typical availability.
- The `BuySheet` relies on 4 rigid hardcoded text chips (`"Today, evening"`, `"Tomorrow, morning"`, `"Tomorrow, evening"`, `"Ask in chat"`).
- Once a deal is created, there is no structured agreement or rescheduling mechanism for date & time in the chat or on `/deals`.

This design implements a **flexible, two-way date & time handover scheduling system**:
1. **Lightweight Seller Availability Windows** (Optional preference chips in `/sell`).
2. **Interactive Buyer Pickup Time Picker** in `BuySheet` (Calendar day selector + Time picker aligned with seller preferences).
3. **Structured Deal Schedule Agreement in Chat & `/deals`** with 1-tap **[Accept Time]** and **[Reschedule]** actions.
4. **Food Drops Exemption:** Food drops remain strictly immediate (*"Pickup now / ready now"* with live countdown).
5. **Aesthetic Constraint:** Zero emojis. Minimalist, premium, non-AI aesthetic with tabular typography, subtle borders, and clean SVG iconography.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Seller Availability Windows in `/sell`**:
   - Optional preference chips:
     `Morning (8 AM - 12 PM)`, `Afternoon (12 PM - 5 PM)`, `Evening (5 PM - 9 PM)`, `Late Night (9 PM - 12 AM)`, `Flexible / Anytime`.
   - Stored on `listings.pickup_slots text[]`.
2. **Buyer Date & Time Picker in `BuySheet`**:
   - Day selector (Next 5 days: *Today*, *Tomorrow*, *+2d*, *+3d*, *+4d*).
   - Time selector with quick slots tailored to seller's preferred window + native time input.
   - Saves structured ISO timestamp `handover_scheduled_at` on `transactions`.
3. **Deal Schedule Agreement & Rescheduling**:
   - Deal card on `/deals` and chat header displays:
     `Scheduled Handover: Friday, 20 Nov at 7:30 PM`.
   - Two-way confirmation:
     - Proposed state: recipient sees `[Confirm time]` and `[Reschedule]`.
     - Confirmed state: check icon + `[Add to Calendar]`.
     - Rescheduled state: counter-proposal updates `handover_scheduled_at` and notifies other party.
4. **Food Drop Immediate Handling**:
   - Food drops completely bypass scheduling and display:
     `Immediate pickup · Ready now (expires in Xm)`.
5. **Zero Emojis & Premium Finish**:
   - Use Lucide / system SVG icons (`cal`, `clock`, `check`, `arrow`).
   - Clean tabular numerals (`font-variant-numeric: tabular-nums`).

### Non-Goals
- Two-way syncing with external Google Calendar APIs / OAuth permissions (we provide instant 1-tap web `.ics` / calendar links without login friction).
- Automated penalty fees for missing a pickup time (stays student-to-student reputation / Plume based).

### Anti-Goals
- **No Rigid Calendar Blocks:** Never block a buyer from buying if a seller hasn't specified slots; preferences guide rather than restrict.
- **No Emojis:** Never use emojis in UI buttons, badges, chips, or system messages.

---

## 3. Database Schema Changes (`20261119000002_handover_scheduling.sql`)

1. **`listings` Table Extension**:
   ```sql
   ALTER TABLE public.listings
   ADD COLUMN IF NOT EXISTS pickup_slots text[] NOT NULL DEFAULT '{}';
   ```

2. **`transactions` Table Extension**:
   ```sql
   ALTER TABLE public.transactions
   ADD COLUMN IF NOT EXISTS handover_scheduled_at timestamptz NULL,
   ADD COLUMN IF NOT EXISTS handover_status text NOT NULL DEFAULT 'proposed'
     CONSTRAINT transactions_handover_status CHECK (handover_status IN ('proposed', 'confirmed', 'rescheduled', 'completed')),
   ADD COLUMN IF NOT EXISTS handover_proposed_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;
   ```

3. **`update_handover_schedule` Database RPC / Server Action**:
   - Verifies caller is buyer or seller.
   - Updates `handover_scheduled_at`, `handover_status`, and `handover_proposed_by`.
   - Inserts audit / chat notification.

---

## 4. Component Architecture

### A. Core Schedule Picker Component
`src/features/deals/components/handover-time-picker.tsx`:
- Date selector: horizontal day tabs (`Today`, `Tomorrow`, `Sat 21`, etc.).
- Time selector:
  - Preset time chips filtered by seller preference.
  - Precise time input (`<input type="time" />`).
- Summary preview: `Pickup: Friday, Nov 20, 7:30 PM`.

### B. Sell Form Integration
`src/features/listings/listing-form/listing-form.tsx`:
- Added to Step 3 below the Spot Picker.
- Titled: `Typical Availability (Optional)`.
- Multi-select chips: `Morning`, `Afternoon`, `Evening`, `Late Night`, `Flexible`.

### C. Buy Sheet Integration
`src/features/item/sheets.tsx` (`BuySheet`):
- Replaces generic text chips with `<HandoverTimePicker />`.
- Submits `scheduledAt` ISO timestamp to `requestBuy`.

### D. Chat & Deals Agreement Card
`src/features/deals/components/handover-status-badge.tsx`:
- Rendered in `thread-view.tsx` and `deals-view.tsx`.
- Displays scheduled date/time with status tag (*Proposed*, *Confirmed*).
- Action buttons: `Confirm time`, `Reschedule`, `Add to Calendar`.

---

## 5. Verification Matrix
- Zod schema validation tests for `pickupSlots` and `scheduledAt`.
- Server action tests for `requestBuy` with structured timestamps.
- Server action tests for `confirmHandoverTime` and `rescheduleHandoverTime`.
- UI rendering tests verifying zero emojis, proper time formatting, and drawer/modal integration.
