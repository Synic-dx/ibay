# Design Doc: Mayu Gemini Multi-Tier Fallback Cascade

**Date:** 2026-11-19  
**Status:** Approved  
**Target:** `src/app/api/mayu/route.ts`, `src/features/mayu/mayu-sheet.tsx`, `src/features/mayu/tools.ts`, `package.json`, `.env.example`, `.env.local`

---

## 1. Intent & The Why
Enable i-bay's campus shopping assistant (**Mayu**) to run reliably on 100% free Google Gemini API models, with a multi-model fallback cascade providing maximum uptime and zero out-of-pocket costs for IIM Indore students.

---

## 2. Goals, Non-Goals, and Anti-Goals
- **Goals:**
  - Maintain the official assistant name as **Mayu** across UI copy, system prompts, and responses.
  - Configure the user's Gemini API key securely in `.env.local`.
  - Implement a resilient multi-tier fallback cascade across available Gemini models:
    1. **Gemini 3.1 Flash Lite** (Primary: 500 RPD, 15 RPM, 250K TPM)
    2. **Gemini 3.5 Flash Lite** (Tier 2: 500 RPD, 15 RPM, 250K TPM)
    3. **Gemini 2.5 Flash Lite** (Tier 3: 20 RPD, 10 RPM, 250K TPM)
    4. **Gemini 3 Flash / 3.8 Flash** (Tier 4: 20 RPD, 5 RPM, 250K TPM)
    5. **Local Database Keyword Search** (`fallbackAnswer`: 0 API cost, infinite capacity)
  - Preserve all existing tool calling (`search_listings`, `get_listing`, `list_open_requests`, `explain_plume`, `get_my_stats`) and interactive listing cards.
- **Non-Goals:**
  - Redesigning the underlying database schema or adding paid external services.
- **Anti-Goals:**
  - Exposing the user to 429/quota error screens; the assistant must silently fail over down the chain until an answer is delivered.

---

## 3. Quotas & Capabilities
- **Combined High-Volume AI Quota:** 1,000+ requests per day across Flash Lite models + extra fallback headroom on standard Flash.
- **Instant Local Fallback:** Never leaves the user with an empty screen or error message if all API quotas are exhausted.
- **Transport:** Streaming NDJSON (`application/x-ndjson`) matching the existing client stream parser.

---

## 4. Architecture & Implementation Specifics
1. **Dependency:** Install `@ai-sdk/google` to integrate with Vercel AI SDK (`ai` v7).
2. **Environment Configuration:**
   - Store API key in `.env.local` as `GEMINI_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`.
   - Update `.env.example`.
3. **Multi-Tier Cascade in `/api/mayu/route.ts`:**
   - Iterate through model list in priority order on rate-limit (429) or initiation failure.
   - Fall back to `fallbackAnswer` if all models fail.
4. **UI & Identity:**
   - Keep existing branding and copy as **Mayu** in `mayu-sheet.tsx`, `tools.ts` (`MAYU_SYSTEM`), and client UI.
