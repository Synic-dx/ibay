# Enhanced Buyer/Seller Deal Workflow & Clean Chat Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the cramped desktop chat dock by replacing heavy stacked handover cards with a sleek, 36px consolidated status bar and an interactive slide-over Handover Pass drawer, separating chat communication from pickup code verification.

**Architecture:** 
- Replace multi-card fixed headers in `thread-view.tsx` with a unified `ChatDealBar` component (36px fixed height).
- Build a slide-over `HandoverPassSheet` accessible from the chat bar containing meeting scheduling, Google Calendar sync, and the delivery/return pickup code for buyers, or direct code verification for sellers.
- Connect the slide-over drawer to the dedicated `/deals` tracking page where full deal progression and history are maintained.
- Adjust CSS for `.dk-win`, `.dk-msgs`, and `.dealbar` in `src/styles/ibay.css` so chat messages have 320px+ of clean vertical scroll space.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Vitest, `@tanstack/react-query`, CSS modules / global `ibay.css`.

**Spec:** `docs/superpowers/specs/2026-11-20-chat-deal-workflow-enhancement-design.md`

## Global Constraints
- Strictly zero emojis in any UI string, icon, component, test, or git message.
- Maintain full parity between `master` and `origin/ujjwal/campus-map`.
- All existing handover server actions (`getHandoverOtp`, `verifyHandoverOtp`, `confirmHandoverTime`, `rescheduleHandoverTime`) must remain fully functional.
- Responsive design must function identically in desktop dock (340px width), full-page chat (`/messages`), and mobile viewports.

## Review Focus
1. **Dock Height Constraint**: Verify that in a 480px dock window, message history has at least 300px of visible scroll area even when a deal is agreed and handover is scheduled.
2. **Buyer vs. Seller Role Views**: Ensure the buyer sees "View Pass" (revealing OTP and pickup instructions) and the seller sees "Verify Deal" (providing code entry and checklist).
3. **Modal & Sheet Stacking**: Ensure opening the Handover Pass sheet inside the desktop dock or on mobile does not trap scroll or collide with existing modals (`RateSheet`, `ReportModal`).
4. **Reschedule & Realtime Updates**: Ensure rescheduling time or regenerating OTP from within the pass sheet updates the chat bar schedule and reflects immediately without broken states.
5. **No Visual Overlap**: Ensure quick-reply action chips (`.dk-qr`) never overlap or clip messages or input fields.

---

## Tasks

### Task 1: Create the Unified Chat Deal Status Bar (`ChatDealBar`)

**Files:**
- Create: `src/features/chat/components/chat-deal-bar.tsx`
- Test: `src/features/chat/components/chat-deal-bar.test.tsx`
- Modify: `src/features/chat/thread-view.tsx:84-121`

- [ ] **Step 1.1**: Write the unit test for `ChatDealBar` verifying:
  - Renders deal amount and status cleanly in a single line.
  - Formats scheduled time (e.g., "Today, 3:00 PM") when present.
  - Displays "View Pass" button for buyers and "Verify Deal" button for sellers.
  - Calls `onOpenPass` callback when clicked.
- [ ] **Step 1.2**: Run `npx vitest run src/features/chat/components/chat-deal-bar.test.tsx` to confirm failure (component does not exist yet).
- [ ] **Step 1.3**: Implement `ChatDealBar` in `src/features/chat/components/chat-deal-bar.tsx` with:
  - Slim 36px height flex row layout.
  - SVG icons (`check`, `clock`, `ticket`, `shield`).
  - Strict zero emoji compliance.
- [ ] **Step 1.4**: Run `npx vitest run src/features/chat/components/chat-deal-bar.test.tsx` and confirm tests pass.
- [ ] **Step 1.5**: Commit Task 1 changes.

---

### Task 2: Build the Slide-Over Handover Pass Drawer (`HandoverPassSheet`)

**Files:**
- Create: `src/features/deals/components/handover-pass-sheet.tsx`
- Test: `src/features/deals/components/handover-pass-sheet.test.tsx`
- Modify: `src/features/deals/index.ts` (export new sheet if applicable)

- [ ] **Step 2.1**: Write the unit test for `HandoverPassSheet` verifying:
  - Renders listing summary, other user name, and agreed price.
  - For buyers: renders `HandoverOtpDisplay` with copy action, instructions, and calendar sync.
  - For sellers: renders quick OTP entry form with verify button and deal checklist.
  - Renders deep-link button to full deal tracking page (`/deals`).
  - Closes cleanly when close button or backdrop is clicked.
- [ ] **Step 2.2**: Run `npx vitest run src/features/deals/components/handover-pass-sheet.test.tsx` to confirm failure.
- [ ] **Step 2.3**: Implement `HandoverPassSheet` in `src/features/deals/components/handover-pass-sheet.tsx` using `Sheet` from `@/components/ui/sheet`.
- [ ] **Step 2.4**: Run `npx vitest run src/features/deals/components/handover-pass-sheet.test.tsx` and confirm all tests pass.
- [ ] **Step 2.5**: Commit Task 2 changes.

---

### Task 3: Refactor `thread-view.tsx` and Clean Up Desktop Chat Dock

**Files:**
- Modify: `src/features/chat/thread-view.tsx`
- Modify: `src/styles/ibay.css:628-670`
- Test: `src/features/chat/thread-view.test.tsx` (or vitest suite)

- [ ] **Step 3.1**: In `thread-view.tsx`, replace the stacked `dealbar`, `HandoverStatusBadge`, and `HandoverOtpDisplay` with `<ChatDealBar onOpenPass={() => setPassOpen(true)} />` and conditionally render `<HandoverPassSheet open={passOpen} onOpenChange={setPassOpen} ... />`.
- [ ] **Step 3.2**: In `src/styles/ibay.css`:
  - Update `.dk-win .dealbar` to have `height: 36px`, `padding: 0 12px`, and seamless border styling.
  - Ensure `.dk-msgs` retains `flex: 1` with minimum height 300px so chat bubbles are never compressed.
  - Ensure `.dk-qr` chips have proper relative positioning and do not overlap chat input or messages.
- [ ] **Step 3.3**: Run `npm run typecheck` and `npx vitest run` to verify compilation and test passes.
- [ ] **Step 3.4**: Commit Task 3 changes.

---

### Task 4: Enhance Deal Tracking Page (`/deals`) Workflow

**Files:**
- Modify: `src/features/deals/deals-view.tsx`
- Test: `src/features/deals/deals-view.test.tsx` (or existing deal tests)

- [ ] **Step 4.1**: Verify that `/deals` cleanly supports the direct entry flow:
  - When the seller visits from the chat link, automatically highlight or open the verification action for that deal.
  - Ensure the buyer's pickup pass on `/deals` displays identical OTP data and instructions.
- [ ] **Step 4.2**: Run tests: `npx vitest run src/features/deals/`.
- [ ] **Step 4.3**: Commit Task 4 changes.

---

### Task 5: End-to-End Verification & Remote Sync

**Files:**
- Verification only

- [ ] **Step 5.1**: Run full project test suite: `npx vitest run`.
- [ ] **Step 5.2**: Run production Next.js build: `npm run build`.
- [ ] **Step 5.3**: Start dev server and capture desktop dock screenshot with an active deal to verify visual layout, lack of clutter, and smooth drawer opening.
- [ ] **Step 5.4**: Sync `master` and push to `origin/master` and `origin/ujjwal/campus-map`.
