# Mayu Gemini Multi-Tier Fallback Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Power the i-bay campus shopping assistant (**Mayu**) with a free, multi-tier Google Gemini fallback cascade (`@ai-sdk/google`) and zero-downtime local database fallback.

**Architecture:** Incoming questions to `/api/mayu` run through a resilient multi-model cascade engine. The engine iterates over available Gemini models in priority order (`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.0-flash`, etc.). If a model encounters a rate-limit (429) or quota ceiling, it immediately catches and fails over to the next tier, ultimately falling back to i-bay's local keyword search (`fallbackAnswer`) if all API quotas are exhausted.

**Tech Stack:** Next.js 16 (App Router), `@ai-sdk/google`, Vercel AI SDK (`ai` v7), Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-19-mayu-gemini-cascade-design.md`

## Global Constraints

- The assistant name remains **Mayu** across all UI text, launcher labels, sheet titles, and system prompts.
- The user's Gemini API key is stored in `.env.local` as `GEMINI_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`, and never committed to git.
- The route must stream `application/x-ndjson` format with `{"t":"text","v":...}`, `{"t":"cards","v":...}`, and `{"t":"done"}` event types.
- Tool calling remains read-only (`search_listings`, `get_listing`, `list_open_requests`, `explain_plume`, `get_my_stats`).
- No rate-limit (429) or unhandled error screens may reach the end-user; failover must be transparent.

## Review Focus

1. **Missing or invalid API key:** Returns `fallbackAnswer` immediately without unhandled rejections or throwing 500s.
2. **Quota 429 on Primary Tier:** Catch block advances cleanly to the next Gemini model in the cascade without breaking the client stream.
3. **Card Generation:** Real listing cards from `search_listings` or `get_listing` are captured and emitted as `cards` events.
4. **All Tiers Exhausted:** The client still receives a helpful answer with matching listing cards via `fallbackAnswer`.
5. **Name Consistency:** The sheet header, launcher button aria-labels, and initial welcome greeting continue to display **Mayu**.

---

### Task 1: Environment & Dependency Setup

**Files:**
- Modify: `package.json`
- Create: `.env.local`
- Modify: `.env.example`

**Interfaces:**
- Produces: `@ai-sdk/google` package installed and `process.env.GEMINI_API_KEY` available in server runtime.

- [ ] **Step 1: Write failing test verifying environment and package resolution**

Create `src/features/mayu/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("Mayu Environment Configuration", () => {
  it("resolves @ai-sdk/google correctly", async () => {
    const mod = await import("@ai-sdk/google");
    expect(mod.createGoogleGenerativeAI).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/mayu/env.test.ts`
Expected: FAIL with "Cannot find package '@ai-sdk/google'"

- [ ] **Step 3: Install `@ai-sdk/google` and configure `.env.local`**

Run: `npm install @ai-sdk/google`
Add to `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```
Update `.env.example` with `GEMINI_API_KEY=` placeholder.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/mayu/env.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example src/features/mayu/env.test.ts
git commit -m "chore: install @ai-sdk/google and configure gemini environment"
```

---

### Task 2: Multi-Tier Gemini Cascade Engine

**Files:**
- Create: `src/features/mayu/cascade.ts`
- Create: `src/features/mayu/cascade.test.ts`

**Interfaces:**
- Produces: `streamWithGeminiCascade({ messages, viewer, onCards, apiKey })`
- Consumes: `@ai-sdk/google`, `MAYU_SYSTEM`, `mayuTools`, `fallbackAnswer`

- [ ] **Step 1: Write test for cascade model order and fallback configuration**

Create `src/features/mayu/cascade.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { GEMINI_FALLBACK_MODELS } from "./cascade";

describe("Gemini Cascade Configuration", () => {
  it("defines cascade models with Flash Lite as priority", () => {
    expect(GEMINI_FALLBACK_MODELS.length).toBeGreaterThanOrEqual(2);
    expect(GEMINI_FALLBACK_MODELS[0]).toContain("flash");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/mayu/cascade.test.ts`
Expected: FAIL with "Cannot find module './cascade'"

- [ ] **Step 3: Implement `src/features/mayu/cascade.ts`**

Define:
```ts
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];
```
Implement `streamWithGeminiCascade`:
Iterates through candidate models using `createGoogleGenerativeAI({ apiKey })`.
Calls `streamText({ model: google(modelName), system: MAYU_SYSTEM, messages, tools, stopWhen: isStepCount(4) })`.
If model throws 429/quota error on init or streaming, logs warning and tries next model in `GEMINI_FALLBACK_MODELS`.
If all models throw or fail, returns `null` so the caller invokes `fallbackAnswer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/mayu/cascade.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/mayu/cascade.ts src/features/mayu/cascade.test.ts
git commit -m "feat(mayu): implement multi-tier gemini cascade engine"
```

---

### Task 3: Integrate Cascade in `/api/mayu/route.ts`

**Files:**
- Modify: `src/app/api/mayu/route.ts`
- Test: `src/app/api/mayu/route.test.ts`

**Interfaces:**
- Consumes: `streamWithGeminiCascade` from `@/features/mayu/cascade`, `MAYU_SYSTEM` from `@/features/mayu/tools`, `fallbackAnswer`
- Produces: POST route streaming `application/x-ndjson` with transparent multi-model failover.

- [ ] **Step 1: Write integration test for `/api/mayu` response**

Create `src/app/api/mayu/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/mayu", () => {
  it("rejects invalid body with 400", async () => {
    const req = new Request("http://localhost:3000/api/mayu", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify baseline route behavior**

Run: `npx vitest run src/app/api/mayu/route.test.ts`
Expected: PASS

- [ ] **Step 3: Update `src/app/api/mayu/route.ts` to use Gemini cascade**

1. Read API key: `process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY`.
2. Replace single `openai("gpt-4o")` stream with `streamWithGeminiCascade`.
3. If cascade yields stream parts, pipe `text-delta` and `tool-result` (`cards`) to NDJSON stream.
4. If cascade fails or returns empty, invoke `fallbackAnswer(question, viewer)`.
5. Insert audit log to `ai_conversations` as before.

- [ ] **Step 4: Run route and cascade tests**

Run: `npx vitest run src/app/api/mayu/route.test.ts src/features/mayu/cascade.test.ts`
Expected: PASS

- [ ] **Step 5: Run full project typecheck and test**

Run: `npm run typecheck && npm run test`
Expected: All tests PASS and no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mayu/route.ts src/app/api/mayu/route.test.ts
git commit -m "feat(mayu): wire /api/mayu to gemini multi-tier cascade engine"
```

---

### Task 4: Live Verification & Self-Review

**Files:**
- Temporary Verification: `src/features/mayu/verify-cascade.ts`

- [ ] **Step 1: Perform end-to-end simulation test with user API key**

Create `src/features/mayu/verify-cascade.ts` to test calling the Gemini API with the user's key and confirming response streaming.
Run with: `npx tsx src/features/mayu/verify-cascade.ts`
Expected: Successful response stream and/or clean fallback.
Clean up the scratch file after verification.

- [ ] **Step 2: Run full build and test suite**

Run: `npm run check` (runs lint, typecheck, and test).
Expected: All checks clean.

- [ ] **Step 3: Final Commit**

```bash
git commit --allow-empty -m "chore: verified Mayu Gemini multi-tier cascade"
```
