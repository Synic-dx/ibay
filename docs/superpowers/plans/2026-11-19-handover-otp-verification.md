# Secure Handover & Return OTP Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tamper-proof 6-digit OTP verification system for peer-to-peer campus exchanges on both delivery/pickup and rental returns, matching the Amazon/Flipkart verification model.

**Architecture:** The buyer receives a secure 6-digit numeric OTP when an order is placed (or when a rental is ready for return). The seller enters this OTP on their device during the in-person meeting. Stored securely with SHA-256 hashes and rate-limited to 5 attempts before temporary lockout. An atomic database function validates the code and advances the deal stage.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL, PL/pgSQL, RLS), TypeScript, React, Lucide Icons, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-19-handover-otp-verification-design.md`](file:///Users/ujjwalharsh/.gemini/antigravity/scratch/ibay/docs/superpowers/specs/2026-11-19-handover-otp-verification-design.md)

## Global Constraints
- **Zero Emojis:** Strictly no unicode emojis in UI code, buttons, badges, chips, or notifications. Use Lucide SVG icons only.
- **Aesthetic Finish:** Premium, minimal, campus-tailored styling with tabular numerals (`font-variant-numeric: tabular-nums`).
- **Target Branch:** `ujjwal/campus-map`.
- **Standing Git Rule:** Always run `git pull origin ujjwal/campus-map` before pushing to `origin/ujjwal/campus-map`.
- **TDD:** Write failing tests first (RED), then implement (GREEN), and verify before commit.

## Review Focus
1. An unauthorized user (seller or third party) must never be able to read the plain OTP via any query or API response.
2. Brute-force guessing must be blocked after 5 invalid attempts with lockout timestamp.
3. Buyer copy action and seller paste action must handle spaces, dashes, or full 6-digit paste cleanly.
4. Food drops must also generate an OTP to enable fast 5-second verification.
5. Rental return stage must generate a distinct Return OTP separate from the pickup OTP.

---

### Task 1: Database Migration & Core Verification Functions

**Files:**
- Create: `supabase/migrations/20261119000003_handover_otp.sql`
- Create: `src/features/deals/__tests__/handover-otp.test.ts`
- Create: `src/features/deals/otp-crypto.ts`

- [ ] Write failing test in `src/features/deals/__tests__/handover-otp.test.ts` testing 6-digit OTP generation, SHA-256 hashing, and verification matching.
- [ ] Run test to verify it fails (RED).
- [ ] Implement `src/features/deals/otp-crypto.ts` with `generateOtp()`, `hashOtp(code)`, and `verifyOtpHash(code, hash)`.
- [ ] Create migration `supabase/migrations/20261119000003_handover_otp.sql` adding `delivery_otp_hash`, `delivery_otp_plain`, `return_otp_hash`, `return_otp_plain`, `otp_attempts`, `otp_locked_until` on `transactions`, and the `verify_handover_otp` function.
- [ ] Run tests to verify they pass (GREEN).
- [ ] Commit Task 1.

---

### Task 2: Server Actions & Deal Query Integrations

**Files:**
- Modify: `src/features/deals/actions.ts`
- Modify: `src/features/deals/stages.ts`
- Modify: `src/features/deals/queries.ts`
- Modify: `src/features/chat/queries.ts`

- [ ] Extend `Deal` type in `src/features/deals/stages.ts` and `Thread` deal type in `src/features/chat/queries.ts` with OTP fields.
- [ ] In `src/features/deals/queries.ts`, select `delivery_otp_plain`, `return_otp_plain`, `otp_attempts`, `otp_locked_until`, exposing plain OTPs only when `role === 'buyer'`.
- [ ] In `src/features/deals/actions.ts`:
  - Update `requestBuy` to generate `delivery_otp` and `delivery_otp_hash` at transaction creation.
  - Implement `getHandoverOtp(txId: string, step: "pickup" | "return")`.
  - Implement `verifyHandoverOtp(txId: string, code: string, step: "pickup" | "return")`.
  - Implement `regenerateHandoverOtp(txId: string, step: "pickup" | "return")`.
- [ ] Run test suite to verify no regressions.
- [ ] Commit Task 2.

---

### Task 3: Buyer Handover OTP Display Component

**Files:**
- Create: `src/features/deals/components/handover-otp-display.tsx`

- [ ] Build `HandoverOtpDisplay`:
  - Segmented 6-digit monospace presentation: `[ 4 ] [ 8 ] [ 1 ]   [ 9 ] [ 2 ] [ 0 ]`.
  - 1-tap copy button with visual feedback.
  - Step-aware explanatory note ("Read this code to [Seller] after inspecting the item and paying").
  - Clean regenerate button if needed.
  - 100% emoji-free UI with Lucide SVG icons.
- [ ] Run typecheck.
- [ ] Commit Task 3.

---

### Task 4: Seller Handover OTP Modal & Segmented PIN Input

**Files:**
- Create: `src/features/deals/components/otp-pin-input.tsx`
- Create: `src/features/deals/components/handover-otp-modal.tsx`

- [ ] Build `OtpPinInput`:
  - 6 individual numeric input cells with auto-advance, backspace navigation, arrow key support, and clipboard paste.
  - Accessible `inputMode="numeric"`, `aria-label="Digit N"`.
- [ ] Build `HandoverOtpModal`:
  - Sheet/Modal displaying deal title, other person's name, step instructions.
  - Error alert with remaining attempts feedback.
  - Loading spinner on submit.
  - Success transition that automatically triggers deal progression.
- [ ] Run typecheck.
- [ ] Commit Task 4.

---

### Task 5: Integration into `/deals` Screen & Chat Thread & Full Verification

**Files:**
- Modify: `src/features/deals/deals-view.tsx`
- Modify: `src/features/chat/thread-view.tsx`
- Modify: `src/features/map/components/handover-card.tsx`

- [ ] In `src/features/deals/deals-view.tsx`:
  - For Buyer: Show `HandoverOtpDisplay` directly inside the active deal card.
  - For Seller: Render `[Verify Delivery OTP]` or `[Verify Return OTP]` button opening `HandoverOtpModal`.
- [ ] In `src/features/chat/thread-view.tsx` & `HandoverCard`:
  - Show OTP indicator badge so users can check or verify their code directly from the chat context.
- [ ] Run full test suite (`npm run test`), typecheck (`npm run typecheck`), and Next.js build (`npm run build`).
- [ ] Run emoji scanner to ensure 0 emojis across all code.
- [ ] Pull latest changes with `git pull origin ujjwal/campus-map` and push to remote.
- [ ] Commit Task 5.
