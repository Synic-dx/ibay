# Design Doc: Enhanced Buyer/Seller Deal Workflow & Clean Chat Dock

**Date:** 2026-11-20  
**Status:** In Review  
**Target:** `src/features/chat/*`, `src/features/deals/*`, `src/styles/ibay.css`

---

## 1. Intent & Context

In **i-bay**, peer-to-peer campus buying, renting, and selling transactions are coordinated through chat and finalized in person at campus hostels. 

### The Problem
In the desktop floating chat dock (`dk-win`, 340px wide x 480px max height), when a deal is agreed or scheduled:
1. `thread-view.tsx` vertically stacks four separate fixed header components above the message feed:
   - Header bar (52px)
   - Product context bar (52px)
   - Deal agreed bar (34px)
   - `HandoverStatusBadge` card (approx 90px)
   - `HandoverOtpDisplay` 6-box OTP card (approx 140px)
   - Bottom quick replies and chat input bar (82px)
2. **Total fixed height exceeds 450px**, leaving less than 30px for the actual chat conversation. Chat messages are squashed, quick reply chips overlap, and the viewport is virtually unusable.
3. **UX anti-pattern**: Displaying raw 6-digit delivery pickup codes directly in the messaging stream is awkward and unlike platforms like Amazon, Flipkart, or Swiggy, where messaging is reserved for communication and fulfillment credentials reside in a dedicated pass or order drawer.

---

## 2. New vs. Old Workflow Comparison

| Dimension | Old Experience | New Enhanced Experience |
|---|---|---|
| **Chat Dock Header Space** | 4 stacked cards (~320px fixed height) consuming 85% of dock viewport | 1 slim consolidated status strip (36px fixed height) freeing up 280px+ for messages |
| **Delivery OTP Presentation** | Raw 6-digit boxes permanently pinned inside the chat window | Secure, tucked into a slide-over **Handover Pass Drawer** accessible via a single tap |
| **Seller Verification Entry** | Ambiguous in chat; seller had to navigate away to `/deals` | Contextual action pill in chat: `[ Verify Code ▾ ]` opens pass drawer with direct OTP input or quick-jump to `/deals` |
| **Meeting Logistics** | Scheduling and calendar links took up an entire separate card | Integrated smoothly into the slide-over Handover Pass drawer |
| **Role Separation** | Buyer and seller saw asymmetric, cluttered interfaces | Both parties see a clean 36px status strip with role-appropriate CTAs (`View Pass` for buyer, `Verify Code` for seller) |
| **Full Deal Hub** | `/deals` and `/deals/[id]` duplicate what was already forced into chat | `/deals` remains the comprehensive tracking and history center |

---

## 3. Architecture & Component Decomposition

### A. Compact Deal Status Bar (`src/features/chat/components/chat-deal-bar.tsx`)
A unified, single-row sticky strip (36px height) rendered below the product context bar in `thread-view.tsx`:
- **Left**: Status icon + meeting schedule or deal state (e.g., `✓ Handover Today, 3:00 PM · ₹1,100`).
- **Right**: Secondary action pill button:
  - Buyer: `[ View Pass ▾ ]`
  - Seller: `[ Verify Deal ▾ ]`

### B. Slide-Over Handover Pass Drawer (`src/features/deals/components/handover-pass-sheet.tsx`)
An accessible slide-over sheet (powered by `Sheet` from `@/components/ui/sheet` or compact overlay):
- **Header**: Listing title, agreed price, and other party's profile.
- **Meeting Logistics**: Campus hostel location, scheduled time, "Add to Google Calendar" button, and "Reschedule" trigger.
- **For Buyer (Delivery / Return Pass)**:
  - Clean `HandoverOtpDisplay` with copy button, obfuscated/revealed digits, and instructions.
- **For Seller (Verification)**:
  - Quick OTP verification input (`OtpPinInput`) allowing the seller to verify the code right then and there without page navigation, OR a direct jump button to the deal tracking page.
- **Footer**: Link to full deal tracking page (`/deals`).

### C. Desktop Dock CSS Optimization (`src/styles/ibay.css`)
- Streamline `.dk-win` sizing and spacing.
- Ensure `.dk-msgs` flexes cleanly with at least 320px of visible scrollable chat area.
- Remove overlapping quick replies (`.dk-qr`) positioning bug.

---

## 4. Constraints & Guarantees
- Zero emojis across all UI, copy, notifications, and code.
- Strict backward compatibility with existing deal stages (`agreed`, `picked_up`, `returned`, `completed`) and server actions (`getHandoverOtp`, `verifyHandoverOtp`, `confirmHandoverTime`).
- Works smoothly on desktop dock (340px width), desktop full-page (`/messages`), and mobile screens.
