# Implementation Plan: Campus Handover Scheduling & Availability Coordination

- Spec: `docs/superpowers/specs/2026-11-19-handover-scheduling-design.md`
- Target Branch: `ujjwal/campus-map`
- Git Strategy: Always `git pull origin ujjwal/campus-map` before pushing.
- Quality Standard: Strictly zero emojis, clean non-AI aesthetic, full TypeScript type safety, TDD (RED-GREEN-Refactor).

---

## Task 1: Database Migration & Core Schema Extensions
**User Value:** Provides persistent storage for seller availability windows and deal handover timestamps.

- **Files Touched**:
  - `supabase/migrations/20261119000002_handover_scheduling.sql`
  - `src/lib/validation/listing.ts`
  - `src/features/listings/types.ts`
  - `src/features/deals/stages.ts`
  - `src/features/deals/queries.ts`
  - `src/features/deals/__tests__/scheduling-schema.test.ts`
- **Step 1:** Write failing test `src/features/deals/__tests__/scheduling-schema.test.ts` validating `pickupSlots` in listing schema and scheduled date validation.
- **Step 2:** Create migration `20261119000002_handover_scheduling.sql` adding `pickup_slots` to `listings`, and `handover_scheduled_at`, `handover_status`, `handover_proposed_by` to `transactions`.
- **Step 3:** Update Zod schemas in `listing.ts` and types in `types.ts` and `stages.ts`.
- **Step 4:** Run test to verify GREEN.
- **Step 5:** Commit: `git commit -m "feat(deals): add database migration and schema types for handover scheduling"`

---

## Task 2: Seller Availability Windows in Sell Form
**User Value:** Lets sellers quickly specify when they are typically free in their hostel without rigid locking.

- **Files Touched**:
  - `src/features/listings/components/availability-picker.tsx`
  - `src/features/listings/listing-form/listing-form.tsx`
  - `src/features/listings/actions/shared.ts`
  - `src/features/listings/actions/create.ts`
  - `src/features/listings/form-values.ts`
- **Step 1:** Write component test for `AvailabilityPicker`.
- **Step 2:** Build `AvailabilityPicker` with 5 clean chips (`Morning`, `Afternoon`, `Evening`, `Late Night`, `Flexible`) using clean SVG icons and zero emojis.
- **Step 3:** Integrate into Step 3 of `listing-form.tsx` below `SpotPicker`.
- **Step 4:** Ensure `pickupSlots` is mapped into database insert in `columnsFor(d)` and `create.ts`.
- **Step 5:** Verify with typecheck and Vitest.
- **Step 6:** Commit: `git commit -m "feat(listings): add seller availability preference picker in sell form"`

---

## Task 3: Buyer Date & Time Picker in Confirm Purchase Sheet
**User Value:** Buyers can pick an exact handover day & time aligned with seller availability.

- **Files Touched**:
  - `src/features/deals/components/handover-time-picker.tsx`
  - `src/features/item/sheets.tsx` (`BuySheet`)
  - `src/features/deals/actions.ts` (`requestBuy`)
  - `src/features/deals/__tests__/request-buy.test.ts`
- **Step 1:** Write failing test for `requestBuy` with ISO `scheduledAt`.
- **Step 2:** Build `HandoverTimePicker` with horizontal day selector (Next 5 days) + time preset chips matching seller preference + precise HTML5 time input.
- **Step 3:** Integrate into `BuySheet` in `sheets.tsx`. For food drops, bypass time picker and show immediate readiness notice.
- **Step 4:** Update `requestBuy` server action to save `handover_scheduled_at`.
- **Step 5:** Run tests to verify GREEN.
- **Step 6:** Commit: `git commit -m "feat(deals): add interactive handover date and time picker in buy sheet"`

---

## Task 4: Deal Confirmation, Agreement & Rescheduling Actions
**User Value:** Sellers and buyers can confirm or reschedule the meeting time with 1 tap in chat and on the deals page.

- **Files Touched**:
  - `src/features/deals/actions.ts`
  - `src/features/deals/components/handover-status-badge.tsx`
  - `src/features/deals/deals-view.tsx`
  - `src/features/chat/thread-view.tsx`
  - `src/features/deals/__tests__/handover-actions.test.ts`
- **Step 1:** Write failing tests for `confirmHandoverTime` and `rescheduleHandoverTime`.
- **Step 2:** Implement server actions `confirmHandoverTime(txId)` and `rescheduleHandoverTime(txId, scheduledAt)` in `deals/actions.ts`.
- **Step 3:** Build `HandoverStatusBadge` displaying tabular date/time, confirmation status, and `[Confirm time]` / `[Reschedule]` buttons.
- **Step 4:** Integrate into `deals-view.tsx` (inside `HandoverCard`) and `thread-view.tsx` (pinned deal banner).
- **Step 5:** Run tests to verify GREEN.
- **Step 6:** Commit: `git commit -m "feat(deals): add handover confirmation and rescheduling actions in chat and deals"`

---

## Task 5: Calendar Export Link & Final Aesthetic Verification
**User Value:** One-click addition to personal calendars and complete verification of error-free, emoji-free UI.

- **Files Touched**:
  - `src/features/deals/calendar.ts`
  - `src/features/deals/components/handover-status-badge.tsx`
- **Step 1:** Build `createCalendarEventUrl(deal)` returning Google Calendar web link.
- **Step 2:** Verify zero emojis across all newly touched components.
- **Step 3:** Run full Vitest suite (`npm run test`), typecheck (`npm run typecheck`), and production build (`npm run build`).
- **Step 4:** Commit: `git commit -m "feat(deals): add calendar export and polish non-AI aesthetic"`
- **Step 5:** Push to `origin/ujjwal/campus-map`.
