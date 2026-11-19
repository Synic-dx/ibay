# Design Doc: Secure Handover & Return OTP Verification

**Date:** 2026-11-19  
**Status:** In Review  
**Target:** `src/features/deals/*`, `src/features/chat/*`, `supabase/migrations/20261119000003_handover_otp.sql`

---

## 1. Intent & Context
In **i-bay**, campus peer-to-peer transactions conclude with an in-person exchange (*"Pay at handover — UPI or cash"*). For both purchases and rentals with substantial deposits (₹400 – ₹2,000), confirming that an item was physically handed over or returned is crucial to prevent disputes.

Currently:
- Deal progression in `stages.ts` (`Agreed` -> `Picked up` -> `Returned` -> `Rate` for rentals, or `Agreed` -> `Handed over` -> `Rate` for sales) is triggered by an unverified modal with self-reported checkboxes (`"We took condition photos"`, `"Payment done"`).
- Either party can unilaterally click confirm even if the exchange never happened.

This design introduces a **tamper-proof 6-digit OTP verification system** modeled after Amazon and Flipkart delivery and return pickups in India:
1. **Delivery / Pickup Step**: Buyer holds a 6-digit Delivery OTP. At the meeting, buyer inspects the item, pays, and reads the OTP to the seller. Seller enters it on their phone to verify receipt and move the deal forward.
2. **Return Step (Rentals)**: Buyer holds a fresh 6-digit Return OTP. Buyer returns the item, seller checks condition and refunds the deposit, and seller enters the buyer's Return OTP to close the rental.
3. **Security**: Stored securely with attempt throttling (max 5 attempts before lockout), atomic validation RPC, and buyer-only read authorization.
4. **Aesthetic Constraint**: Strictly zero emojis. Clean tabular numbers, segmented OTP input boxes, subtle brand borders, and SVG icons.

---

## 2. Core Workflow & Architectural Flow

```
================================================================================
STEP 1: DELIVERY / PICKUP (All Sales & Rentals)
================================================================================
Buyer's Phone                                       Seller's Phone
┌──────────────────────────────────────┐            ┌──────────────────────────────────────┐
│ Handover Delivery OTP                │            │ Meeting with Buyer                   │
│ [ 4  8  1  ·  9  2  0 ]              │            │ [ Verify Pickup Code ]               │
│ "Share with Sara after inspection"   │            └──────────────────┬───────────────────┘
└──────────────────┬───────────────────┘                               │
                   │  Buyer verbally reads OTP to Seller               │
                   └───────────────────────────────────────────────────►
                                                                       │ Seller inputs 6 digits
                                                                       ▼
                                                    ┌──────────────────────────────────────┐
                                                    │ verifyHandoverOtp(txId, code, 'pickup'│
                                                    │ -> Hash match? -> Success!           │
                                                    └──────────────────┬───────────────────┘
                                                                       ▼
                                                    Deal stage advances to 'Handed over' 
                                                    (or 'Picked up' for rentals)

================================================================================
STEP 2: RENTAL RETURN (Rentals Only)
================================================================================
Buyer's Phone                                       Seller's Phone
┌──────────────────────────────────────┐            ┌──────────────────────────────────────┐
│ Rental Return OTP                    │            │ Returning Item from Buyer            │
│ [ 7  3  5  ·  1  6  4 ]              │            │ 1. Check item condition              │
│ "Share after deposit is refunded"    │            │ 2. Refund deposit (UPI/Cash)         │
└──────────────────┬───────────────────┘            │ [ Enter Return Code ]                │
                   │                                └──────────────────┬───────────────────┘
                   │  Buyer gives OTP after deposit is refunded        │
                   └───────────────────────────────────────────────────►
                                                                       │ Seller inputs 6 digits
                                                                       ▼
                                                    ┌──────────────────────────────────────┐
                                                    │ verifyHandoverOtp(txId, code, 'return'│
                                                    │ -> Hash match? -> Success!           │
                                                    └──────────────────┬───────────────────┘
                                                                       ▼
                                                    Deal stage advances to 'Returned'
                                                    Both parties unlocked to Rate!
```

---

## 3. Database Schema (`supabase/migrations/20261119000003_handover_otp.sql`)

### 3.1 Table Alterations: `transactions`
```sql
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS delivery_otp_plain text NULL, -- readable only by buyer via RLS / server action
  ADD COLUMN IF NOT EXISTS return_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS return_otp_plain text NULL,   -- readable only by buyer via RLS / server action
  ADD COLUMN IF NOT EXISTS otp_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until timestamptz NULL;
```

### 3.2 Secure Verification Function (`verify_handover_otp`)
An atomic PostgreSQL function that:
1. Locks the transaction row (`FOR UPDATE`).
2. Validates caller is the seller (`t.seller_id = p_actor`).
3. Checks if `otp_attempts >= 5` and `otp_locked_until > now()` (rejects if locked).
4. Verifies the candidate 6-digit code against the target step's hash (`delivery_otp_hash` for pickup, `return_otp_hash` for return).
5. If invalid: increments `otp_attempts`, sets lockout if >= 5, raises error with remaining attempts.
6. If valid: resets `otp_attempts`, inserts into `handover_checks`, advances `stage`, and marks bookings completed if returned.

---

## 4. Server Actions (`src/features/deals/actions.ts`)

1. **`getHandoverOtp(txId: string, step: "pickup" | "return")`**:
   - Caller must be `buyer_id`.
   - Returns the active 6-digit OTP string.
   - If not yet generated, generates a cryptographically random 6-digit code (`crypto.randomInt(100000, 999999)`), computes SHA-256 hash, and saves both.

2. **`verifyHandoverOtp(txId: string, code: string, step: "pickup" | "return")`**:
   - Caller must be `seller_id`.
   - Validates input format (6 digits).
   - Calls `verify_handover_otp` RPC.
   - Sends real-time chat notification:
     - Pickup: `[Seller] verified the pickup OTP. Handover complete.`
     - Return: `[Seller] verified the return OTP. Rental returned and deposit settled.`
   - Revalidates `/deals` and `/messages`.

3. **`regenerateHandoverOtp(txId: string, step: "pickup" | "return")`**:
   - Buyer can request a new OTP if needed (resets attempt counter, creates new random code).

---

## 5. UI Components & Zero-Emoji Aesthetics

### 5.1 Buyer OTP Card: `HandoverOtpDisplay`
- Large 6-digit readout styled with segmented tabular numerals:
  `[ 4 ] [ 8 ] [ 1 ]   [ 9 ] [ 2 ] [ 0 ]`
- Subtle brand tint background (`rgba(2, 80, 95, 0.06)`), 1px border `var(--brand)`.
- 1-tap copy button with `<Icon name="check" />` feedback.
- Clear instruction note:
  - Pickup: *"Show or read this code to [Seller] after inspecting the item."*
  - Return: *"Show or read this code to [Seller] after inspecting condition and receiving your deposit back."*

### 5.2 Seller OTP Input Modal: `HandoverOtpModal` & `OtpPinInput`
- 6 individual numeric input boxes with auto-focus and auto-advance.
- Supports pasting 6 digits directly (e.g. from WhatsApp or clipboard).
- Clean error messaging with remaining attempt counter (`Incorrect code. 3 attempts remaining.`).
- Confirmed state displays clean green check animation and closes seamlessly.

### 5.3 Deals Screen (`src/features/deals/deals-view.tsx`)
- Replaces the generic "Mark handed over" button:
  - If viewer is **Buyer**: Displays the active OTP card directly inside `HandoverCard`.
  - If viewer is **Seller**: Displays a prominent button:
    `[ Verify Delivery OTP ]` (or `[ Verify Return OTP ]`).
- When seller clicks verify, opens `HandoverOtpModal`.

---

## 6. Edge Cases & Reliability Safeguards
1. **Accidental Clicks**: A seller cannot accidentally or maliciously mark an item delivered without physical presence of the buyer.
2. **Brute Force Protection**: 5 attempts maximum. If exceeded, a 15-minute cooldown locks verification.
3. **No Network at Meeting Spot**: The buyer's OTP is loaded and cached in local React state / storage; the seller can enter it as soon as connectivity resumes or at the spot.
4. **Food Drops**: Immediate food drops also generate an OTP for quick 5-second pickup confirmation.

---

## 7. Testing Strategy
- `src/features/deals/__tests__/handover-otp.test.ts`:
  - Validates 6-digit numeric generation (`100000` to `999999`).
  - Tests SHA-256 hash generation and comparison.
  - Tests attempt counter increment and lockout threshold.
  - Tests buyer authorization (seller cannot read plain OTP via API).
- Production build & Typecheck verification (`npm run typecheck && npm run build`).
- Zero-emoji scanner check across all modified files.
