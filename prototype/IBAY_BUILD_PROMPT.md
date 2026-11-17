# Build prompt: i-bay (IIM Indore campus marketplace)

Paste everything below into Claude Code in VS Code, from an empty folder. Put the prototype (`index.html` + `img/`) in a `prototype/` folder at the repo root as the visual reference.

---

You are building **i-bay**, a second-hand marketplace for the IIM Indore campus. Students buy, rent, auction and request items from each other, chat to negotiate, and rate each other after every deal. **Mayu**, a peacock mascot, is an AI assistant (OpenAI `gpt-4o`) that searches listings for users.

This is a graded course project. It will be judged on a **live 7 to 8 minute demo of the working website** (no slides), using this rubric:

| Criterion | Weight | What it means for us |
|---|---|---|
| Functionality (working features) | 40% | Login with CAPTCHA, client + server validation, full CRUD, search/sort/filter all work live without errors |
| Code quality (structure, validation, comments) | 20% | Clean folders, shared validation schemas, every feature commented in plain English |
| UI/UX design and responsiveness | 20% | Matches the prototype, works on phone, tablet and laptop, light and dark |
| Innovation or extra features | 10% | Mayu AI, hourly slot rentals, live auctions, hostel-only food drops, Plume trust score, realtime chat |
| Clarity of presentation and Q&A | 10% | A rehearsed demo script, seeded demo data, docs that make every answer easy |

**Rule for every decision: maximise marks on all five rows.** Build the graded basics first and make them flawless (section 1 lists them). Extra features come after. A smaller app that never breaks beats a huge one that crashes on stage.

The `prototype/` folder is the approved clickable UI. Open it in a browser and click through every flow before writing code. Match it exactly: tokens, fonts, spacing, layouts, copy tone and interactions. The prototype already shows the graded flows to copy:
- the CAPTCHA widget on the login modal and on the last step of the sell form
- inline field errors with a simulated server re-check
- Edit listing (the same form, prefilled, with locked fields)
- Pause/Resume
- Delete with a confirm dialog, guard rails, Undo toast and a Deleted tab with Restore
- the My listings table with sortable columns, search, inline price edit and the "Price dropped" badge

Work in phases (section 13). After each phase run `pnpm lint && pnpm typecheck && pnpm test` and fix everything before moving on. Ask me before adding any paid service that isn't listed here.

---

## 1. Grading checklist (the "must be perfect" list)

Each item says **where it lives** and **how to show it in the demo**. Keep this file updated as `docs/RUBRIC.md` in the repo, with file paths filled in.

### 1.1 Login page with proper authentication
- `/login` page (also shown as the blurred auth modal for guests) with: **Continue with Google** (only `@iimidr.ac.in`), **email + 6-digit OTP**, Sign in / Create account toggle, logout, protected routes.
- Session: Auth.js v5, JWT in an httpOnly, secure, sameSite=lax cookie. `middleware.ts` protects `/sell`, `/my-listings`, `/listings/*/edit`, `/deals`, `/messages`, `/account`, `/admin`.
- Security extras worth mentioning in Q&A: OTP stored only as a bcrypt hash, 10 min expiry, 5 wrong attempts locks that code, resend cooldown 30 s, rate limits per email and per IP, domain check on the server (never trust the client), CSRF protection from Auth.js, logout clears the session everywhere.
- **Demo:** sign out, try `abc@gmail.com` (blocked with a clear message), sign in with a campus email, show the OTP screen, land back on the page you came from.

### 1.2 CAPTCHA (was missing, now required)
- Provider: **Cloudflare Turnstile** (free, privacy friendly). Make it switchable through env so a broken provider never kills the demo:
  `CAPTCHA_PROVIDER=turnstile | hcaptcha | recaptcha | off`
  - `turnstile`: `@marsidev/react-turnstile` on the client, verify with `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` on the server.
  - `hcaptcha` / `recaptcha` (v2 checkbox): same wrapper component, different verify URL.
  - `off`: allowed only when `NODE_ENV !== 'production'`, and shows a yellow "CAPTCHA disabled (dev)" banner.
- One reusable component `<Captcha onVerify={setToken} />` in `src/components/security/captcha.tsx` and one server helper `verifyCaptcha(token, ip)` in `src/lib/security/captcha.ts`. Every form that uses it sends the token, and the **Server Action verifies it first**, before any database work. No token or a failed check returns a field error: "Please complete the security check."
- Where CAPTCHA appears:
  - Login and sign up (before an OTP email is sent; this stops OTP spam)
  - Resend OTP after 2 resends
  - Create listing (stops spam posts)
  - Post a request, and Report a user or listing
- **Make it visible for grading:** set Turnstile `appearance: 'always'` so the checkbox widget is clearly on screen, not invisible. Use Cloudflare's test site keys on localhost (`1x00000000000000000000AA` always passes, `2x00000000000000000000AB` always fails) so you can show both the pass and the fail case live.
- If the widget can't load (ad blocker, network), show "Security check didn't load. Turn off ad blockers or try another network" with a Retry button, and log it. Never let the form submit without a verified token in production.
- Unit test `verifyCaptcha` with mocked fetch (pass, fail, timeout, missing token).
- **Demo:** show the widget on the login form; submit without completing it and show the server rejecting it; complete it and continue.

### 1.3 Form validation: client side AND server side
Three layers, explained in Q&A as "the browser helps you, the server protects us, the database is the last guard":
1. **Client side (JavaScript):** React Hook Form + `zodResolver`, validation on blur and as you type after the first error, inline red messages under each field, `aria-invalid` + `aria-describedby`, the submit button shows a spinner and stays enabled (clicking it with errors focuses the first bad field). Character counters on long fields. Live hints (e.g. "That's 56% below the original price").
2. **Server side:** every Server Action re-runs **the same Zod schema** (imported from `src/lib/validation/`) plus checks the client can't do: session and ownership, CAPTCHA, rate limits, image size/type from the actual upload, business rules (an auction can't change its minimum after the first bid, and so on). Errors return as `{ ok:false, fieldErrors:{...}, formError? }` and are mapped back onto the same fields.
3. **Database:** `CHECK` constraints, `NOT NULL`, enums, foreign keys and RLS policies, so even a direct API call can't save bad data.

Shared schemas (one file per form), each field with a friendly message:
- `loginSchema`: email trimmed, lowercased, must match `^[a-z0-9._%+-]+@iimidr\.ac\.in$` ("Use your @iimidr.ac.in email").
- `otpSchema`: exactly 6 digits.
- `profileSchema`: name 2 to 60 letters/spaces, hostel from the list, room `^[A-Z]?\d{1,4}$`, WhatsApp optional `^(\+91)?[6-9]\d{9}$`.
- `listingSchema` (discriminated union on `mode`):
  - common fields: title 5 to 80 chars, description up to 1000, category from the list, condition enum, 1 to 6 images (jpg/png/webp, max 5 MB each)
  - `sell`: price integer 0 to 2,00,000. Original price (MRP) is required, must be at least the asking price, and is at most 5,00,000. `purchased_on` is required and can't be in the future or more than 15 years ago.
  - `rent`: rate is at least 1. Unit is hour, day, week or month. A deposit is required, between 0 and 50,000. Original price and `purchased_on` are required as for sell.
  - `auction`: starting bid is at least 1. Optional buy-now must be more than the starting bid. Duration is one of 6 h, 1 d, 3 d or 7 d. Original price and `purchased_on` are required as for sell.
  - `drop`: price 0 to 2,000, available for 15 to 180 min, category forced to `food`, no age or MRP.
  - specs: optional, up to 12 key/value pairs. Supplements require a seal status and an expiry date that isn't already past.
- `requestSchema`: text 5 to 120, budget up to 40, needed-by today to +30 days.
- `bidSchema`, `offerSchema`: whole rupees, at least the minimum next bid / at least 1.
- `ratingSchema`: score -10 to 10, reason 10 to 500 chars.
- **Demo trick:** add a dev-only query flag `?novalidate=1` (ignored in production) that turns off client-side checks, so you can submit a bad form and show the **server** catching it with the same messages. Also show a DB constraint error being turned into a friendly message.

### 1.4 CRUD on listings (Create, Read, Update, Delete), especially Update and Delete
Listings are the main CRUD resource. Sellers fully manage their own posts. Requests and request replies get the same full CRUD (smaller scale), and profiles get read + update.

**Create** (`/sell`, Server Action `createListing`)
- 3-step form from the prototype: (1) deal type, photos, title, auto category guess; (2) price, original price, purchase month/year, size and specs; (3) condition, description, bundle, live preview card. CAPTCHA on the last step. Photos upload to Cloudinary with signed uploads; only URLs are stored.
- On success: redirect to the new item page with a toast "Your listing is live", and the item appears in search right away (revalidate the browse and home caches).

**Read**
- Public reads: home rails, browse grid with search/sort/filter/pagination, item page, seller profile.
- Owner reads: **My listings** dashboard `/my-listings` (section 1.5), the structured view the evaluators want to see.

**Update** (`/listings/[id]/edit`, Server Action `updateListing`)
- The same 3-step form, prefilled with the current values and photos. Photos can be reordered by drag (dnd-kit), removed and added.
- **Only the owner** can open the page (server check + RLS). Anyone else gets a 404, not a 403, so ids aren't leaked.
- Mode-aware rules, enforced on the server and shown in the UI as locked fields with a short reason:
  - Auction with bids: can't change the starting bid, end time or mode. You can still edit the description and photos.
  - Rental with upcoming bookings: can't change the unit. A rate change applies only to new bookings.
  - Sold or ended listings are read-only; "Relist" creates a copy instead.
  - Food drops: only extend the time (max 3 h total) or edit the description.
- **Optimistic concurrency:** the form carries `updated_at`. If the row changed since you opened it (say you edited on your phone too), the server rejects the save with "This listing changed since you opened it. Reload to see the latest" instead of silently overwriting.
- **Price change history:** every price change is written to `listing_price_history`. If the price drops, the card shows a "Price dropped ₹200" badge for 7 days, and users who saved it get a notification.
- **Quick inline updates** on My listings, without opening the form:
  - edit the price in place (click, type, Enter)
  - Pause / Resume (hides from search without deleting)
  - Mark sold (pick the buyer)
  - Extend auction (only with no bids)
- Every update writes an `audit_log` row (who, what changed, before/after JSON). Show it as a small "Edit history" list on the edit page.

**Delete** (Server Action `deleteListing`, plus bulk delete)
- Delete buttons on: the item page owner panel, the edit page (red "Delete listing" in a danger zone at the bottom) and each My listings row, plus a bulk "Delete selected" with checkboxes.
- A confirm dialog says exactly what will happen: "Delete 'Yonex Astrox 77 Pro'? It disappears from search, saved lists and the requests it answered. Chats stay, so buyers know what happened." Buttons are Cancel and a red Delete.
- **Soft delete first:** set `deleted_at` and status `deleted`. The item disappears everywhere at once, and a toast offers **Undo** for 10 s (restores it). Chats and finished deals keep a greyed "Listing deleted" card, so history doesn't break.
- **Hard delete later:** a `pg_cron` job purges listings deleted more than 30 days ago, and a server task removes their Cloudinary images.
- **Guard rails:**
  - Can't delete an auction with bids: offer "End auction" instead.
  - Can't delete a rental with an active or upcoming booking: offer "Pause" instead, and explain why.
  - Only the owner (or an admin) can delete. RLS repeats this rule.
- **Requests:** owners can edit text, budget and needed-by date, close a request ("Found it"), or delete it with a confirm dialog and undo. Repliers can edit or delete their own replies.
- **Profile:** update name, photo, hostel, room and WhatsApp. "Delete my account" is in settings, with a confirm dialog that requires typing DELETE. It anonymises reviews instead of breaking them.

**Demo** (about 2 minutes, the core of the grade):
1. Create a listing in front of them.
2. Show it in the browse grid and in My listings.
3. Edit the price inline, then open the full edit form and change the description. Show the "Price dropped" badge.
4. Try to edit someone else's listing by changing the URL, and show the 404.
5. Delete the listing, show Undo, then delete again.
6. Show the table updating each time.

### 1.5 Data presentation: tables, cards, dashboards, sort, filter, search
- **My listings** `/my-listings` (owner dashboard):
  - Stat tiles: live listings, total views, saves, offers waiting, earned this month.
  - Desktop: a real data table (TanStack Table) with columns for checkbox, photo, title, mode, price (inline editable), original price, age, status pill, views, saves, last updated and actions (Edit, Pause/Resume, Mark sold, Delete).
    - Click a column header to sort (asc/desc arrow).
    - Status tabs: Active / Paused / Sold / Ended / Deleted (30 days).
    - Filter by mode and category, a text search box, and 10 / 25 / 50 rows per page.
    - Everything lives in URL params so a refresh keeps the view.
  - Phone: the same data as stacked cards with the same actions in a "..." menu.
  - Empty state with a "List your first item" button.
- **Browse** `/browse` (public):
  - Full-text search (Postgres FTS + `pg_trgm` for typos).
  - Filters: deal type, my hostel, trusted sellers, available on date, size, age, price range, category.
  - Sorts: best match, biggest discount, price low/high, newest, newest purchase, most trusted.
  - Removable filter chips, result count, pagination or infinite scroll with a "Load more" button.
- **Requests board**: sort by soonest needed / newest / most needed.
- **Deals**: tabs All / Buying / Selling with a step tracker per deal.
- **Admin** `/admin`: a reports table with sort and filter, hide listing, ban user.

### 1.6 HTML, CSS, JavaScript clarity
- Semantic HTML: `header`, `nav`, `main`, `section`, `article` for product cards, `footer`, real `button` and `a`, a labelled form control for every input, and `alt` text on every photo.
- CSS: Tailwind with design tokens as CSS variables (section 4), no inline hex colours in components, light and dark themes.
- JavaScript/TypeScript: typed, small functions, no `any`, comments as in section 2.

---

## 2. Code quality and the commenting standard (20%)

The evaluators will open files during Q&A. Every feature must be easy to find and easy to read.

**Structure**
- `src/app` for routes only (thin pages), `src/features/<feature>/` for each feature's components, actions, queries and validation, `src/lib` for shared helpers, `src/components/ui` for design-system pieces.
- One feature per folder: `features/auth`, `features/captcha`, `features/listings` (create, edit, delete, my-listings), `features/browse`, `features/requests`, `features/chat`, `features/auctions`, `features/deals`, `features/plume`, `features/mayu`.

**Comments (write them simply, like explaining to a classmate)**
1. **File header** at the top of every non-trivial file:
   ```ts
   /**
    * FEATURE: Delete a listing (the "D" in CRUD)
    * WHAT: Soft-deletes a listing so it vanishes from search, with a 10 second undo.
    * WHO CAN USE IT: Only the person who posted it (checked here and again by the database).
    * FLOW: confirm dialog -> deleteListing() -> set deleted_at -> refresh pages -> toast with Undo.
    * RUBRIC: Functionality (CRUD), Code quality (server-side checks).
    */
   ```
2. **JSDoc on every exported function**: one line on what it does, `@param`, `@returns`, and `@throws` where relevant.
3. **Step comments inside longer functions**, numbered:
   ```ts
   // 1. Make sure the user is logged in
   // 2. Check the CAPTCHA token with Cloudflare
   // 3. Validate the form again on the server (never trust the browser)
   // 4. Check the user owns this listing
   // 5. Save, then refresh the cached pages
   ```
4. **`// WHY:` comments** for anything non-obvious, e.g. `// WHY: we return 404 instead of 403 so people can't guess which listing ids exist.`
5. **Rubric tags** so features can be found in seconds with search: `// [RUBRIC:AUTH]`, `[RUBRIC:CAPTCHA]`, `[RUBRIC:VALIDATION-CLIENT]`, `[RUBRIC:VALIDATION-SERVER]`, `[RUBRIC:CRUD-CREATE]`, `[RUBRIC:CRUD-READ]`, `[RUBRIC:CRUD-UPDATE]`, `[RUBRIC:CRUD-DELETE]`, `[RUBRIC:DATA-DISPLAY]`, `[RUBRIC:RESPONSIVE]`, `[RUBRIC:EXTRA]`.
6. **SQL migrations** get a comment above every table, policy and function explaining it in one or two plain sentences.
7. No commented-out dead code, and no vague comments like `// handle stuff`.

**Tooling**
- TypeScript strict, ESLint (next + typescript-eslint + jsx-a11y), Prettier, Husky + lint-staged pre-commit.
- `pnpm check` runs lint, typecheck and tests together.
- Error handling: one `ActionResult<T>` type for all Server Actions, `error.tsx` per route group, and friendly messages (no stack traces shown to users).
- Tests:
  - **Vitest** for the validation schemas (valid and invalid cases for every field), the Plume maths, `verifyCaptcha` and the CRUD permission rules.
  - **Playwright** for the demo path (section 12) so you know it works before you present.

**Docs in the repo**
- `README.md`: what the app is, screenshots (phone + desktop, light + dark), setup in 5 commands, env vars, how to seed, how to deploy.
- `docs/RUBRIC.md`: the section 1 checklist with file paths for each item.
- `docs/ARCHITECTURE.md`: one diagram (browser → Next.js server actions → Supabase/Cloudinary/OpenAI) and the data model.
- `docs/DEMO.md`: the demo script and the Q&A answers (section 12).

---

## 3. UX foundation: personas, journeys, pain points

These drive every screen. If a feature doesn't help one of these people finish their job faster or with less worry, cut it.

| # | Persona | Job to be done | Biggest worry |
|---|---|---|---|
| P1 | **Rahul, first year, first week** | Get a cooler, mattress, cycle, kettle fast and cheap | Doesn't know anyone, scared of being overcharged |
| P2 | **Ananya, senior moving out in 5 days** | Clear 15 items from her room | Listing 15 things one by one; things not selling in time |
| P3 | **Karan, junior in a club preprocess** | Seniors of a club or committee want him in "all orange + wig" tonight (preprocesses are club/committee induction rounds where juniors are made to dress funnily) | Needs the right size, for a few hours tonight, close by |
| P4 | **Priya, CFA candidate** | Needs a BA II Plus only for exam day | Rent vs buy confusion, deposit and return rules |
| P5 | **Dev, hostel night owl** | Ordered extra food at 1 AM, wants it gone in 20 min | Speed. WhatsApp groups ignore it |
| P6 | **Meera, ticket holder who can't attend** | Best price for a concert or match ticket | Doesn't know the right price |
| P7 | **Kabir, lender who got burned** | Rent out his cooler again | Last renter broke it |
| P8 | **Arjun, the haggler** | Better price before buying | Awkward back and forth |
| P9 | **Ananya again, editing** | Drop the price after 3 days with no buyer, or remove an item she gave to a friend | Can't find where to edit, fears losing chats |

Key fixes:
- normalised "≈ ₹/week" for rentals
- trust in plain words ("Trusted seller · 23 deals · Hostel 2")
- "In your hostel" badges
- quick question chips
- quick listing with category guessing
- "Similar items sold for ₹X to ₹Y"
- marking sold auto-replies to other chats
- hourly slot booking for preprocess outfits
- requests with needed-by dates and upvotes
- a clear rental cost breakdown
- 3-field food drops
- eBay-style bidding
- Airbnb-style handover checks
- structured offers in chat
- **My listings with inline price edit, pause, and delete with undo** (for P9)

Cross-cutting rules:
- Search first. One primary action per screen.
- Ratings use labelled anchors and a required reason.
- Show trust in words first, numbers second.
- Saved items and alerts. Plain, short copy with no jokes in system messages.
- No emoji in the UI, and no em dashes in copy.

---

## 4. Design system (copy from the prototype, do not invent)

Limitly's soft "raised card" look on an Amazon/Flipkart structure: white raised cards and pills with soft layered shadows, inset "well" inputs, small uppercase mono labels, teal brand, mint highlights.

Light tokens (`:root`):
```css
--bg:#E3EBED; --surface:#FEFEFE; --surface-2:#F4F7F8; --sunken:#EBF0F1; --photo:#EEF3F4;
--line:rgba(2,32,38,.10); --line-2:rgba(2,32,38,.16);
--ink:#20373C; --ink-2:#3F6068; --ink-3:#567379;
--brand:#02505F; --brand-hover:#02637A; --brand-ink:#02637A; --brand-soft:rgba(2,99,122,.10); --on-brand:#FFFFFF;
--mint:#23DFC6; --mint-soft:rgba(35,223,198,.16); --mint-ink:#04695C; --on-mint:#03322B;
--good:#15702F; --good-soft:rgba(37,161,73,.13); --bad:#BB2C22; --bad-soft:rgba(223,82,74,.13); --warn:#D99A1B; --warn-soft:rgba(217,154,27,.16); --warn-ink:#7A5610;
--glass:color-mix(in srgb,#F9FBFB 78%,transparent); --glass-edge:rgba(255,255,255,.72);
--shr: inset 0 1px 0 rgba(255,255,255,.92), inset 0 -1px 0 rgba(2,32,38,.06), 0 1px 2px rgba(2,32,38,.10), 0 3px 7px -3px rgba(2,32,38,.12);   /* raised */
--shw: inset 0 2px 3px rgba(2,32,38,.12), inset 0 0 0 1px rgba(2,32,38,.05), inset 0 -1px 0 rgba(255,255,255,.80);                        /* well */
--shg: 0 1px 1px rgba(2,32,38,.04), 0 4px 10px -4px rgba(2,32,38,.10), 0 18px 34px -18px rgba(2,32,38,.22);                                 /* floating */
--hero: linear-gradient(120deg,#02505F,#02637A 60%,#0A7E88)
```
Dark tokens (`[data-theme=dark]`), neutral charcoal, not teal:
```css
--bg:#0F1314; --surface:#181E20; --surface-2:#1E2528; --sunken:#121718; --photo:#E4E9EA;
--line:rgba(255,255,255,.07); --line-2:rgba(255,255,255,.13);
--ink:#E6ECEE; --ink-2:#A8B5B9; --ink-3:#85959A;
--brand:#5CC4CF; --brand-hover:#77D0D9; --brand-ink:#7FD1DA; --brand-soft:rgba(92,196,207,.12); --on-brand:#04262B;
--good:#6FCF8B; --bad:#FF8A80; --warn-ink:#EAC06B;
--shr: inset 0 1px 0 rgba(255,255,255,.05), 0 0 0 1px rgba(255,255,255,.05), 0 1px 2px rgba(0,0,0,.45), 0 6px 14px -6px rgba(0,0,0,.55);
--shw: inset 0 2px 4px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.06);
--shg: 0 0 0 1px rgba(255,255,255,.07), 0 20px 40px -16px rgba(0,0,0,.8);
--hero: linear-gradient(120deg,#1C2427,#1F282B)
```
Rules:
- **Cards:** surface, radius 18 to 22px, `--shr`. Product cards lift 3px on hover. Photos sit in a light tile and use `contain`.
- **Buttons:** pills. Primary is brand; secondary is surface + `--shr`; destructive is `--bad` (delete only).
- **Inputs:** wells, radius 14px, mint focus ring. **Error state:** red ring, red message under the field with an icon.
- **Badges:** JetBrains Mono, 10 to 10.5px, uppercase, `.09em` tracking. Badges on photos get a white background.
- **Fonts:** Poppins for UI, JetBrains Mono for labels, badges, timers, OTP and numbers.
- **Theme:** `next-themes` (`attribute="data-theme"`, default system), no flash on load. The **light/dark toggle is always visible in the top-right corner** on every screen size.
- **Icons:** `lucide-react` (stroke 2, 16 to 20px), with the ISC licence credited. The peacock SVG is `<Peacock />`. No emoji.

**Brand:** the platform is **i-bay** (lowercase, with the hyphen). The wordmark gives each letter a colour: `i` #1FC9B2, `-` muted ink, `b` #02637A (dark #3FB6CF), `a` #E0A526, `y` #DF524A, set in Poppins 700 at -0.04em. The favicon is a rounded square #02505F with a mint "i".

---

## 5. Responsive layout (mobile first) [RUBRIC:RESPONSIVE]

Breakpoints: `md` = 720px, `lg` = 1080px (custom Tailwind screens). No horizontal scroll at any width. Respect `env(safe-area-inset-*)`, use `100dvh`, 16px inputs (no iOS zoom) and 44px minimum tap targets.

- **Phone (<720px), edge to edge, no boxed column:**
  - Sticky glass top bar: hamburger, wordmark, bell/avatar or Sign in, theme toggle.
  - Bottom tab bar: Home, Explore, a Sell button in the middle, Chats, You.
  - Bottom sheets (`vaul`), a 2-column grid, snap rails, Instagram-style category "stories".
  - Chats are full screen. Mayu is a round button at the bottom right.
- **Tablet (720 to 1079px):** 3-column grid, 4-column category tiles, and a two-column item page (sticky gallery + details).
- **Desktop (>=1080px), classic ecommerce like Amazon, Flipkart and Myntra.** No sidebar, no hamburger, no bottom tab bar.
  - Full width with `clamp(28px, 4.2vw, 84px)` side gutters.
  - **Header:**
    - Sticky header row 1: logo, "Meet at <hostel>", a rounded search bar with a Material-style category menu (shadcn DropdownMenu, a pill trigger with a rotating chevron, a 4-column grouped panel with icons and a check on the selected item; not a native select), Account, Saved, Chats, Alerts, a Sell button, and the theme toggle at the far right.
    - Row 2: a light category bar ("All categories" opens a hover mega menu; quick links follow).
    - Row 3: the **LIVE ticker**.
  - **Item page:** sticky gallery on the left. On the right, one combined price + buy panel:
    - asking price, % below original, and an age badge
    - a facts row: original price, bought, deposit
    - one 52px primary button, then 2 equal secondary buttons (Make an offer, Chat with seller)
    - a pay-at-handover note
    - for the owner, Edit and Delete instead of buying
  - Sheets open as centered modals. A LinkedIn-style **Messaging dock** sits at the bottom right with pop-up chat windows. **Mayu** is a 60px round button at the very bottom right, to the right of the dock. A full footer.

---

## 6. Product scope

### 6.1 Guest browsing + auth modal
- `/` is the store for everyone. No redirect to login.
- Guests can browse, search, filter and read. Tapping a product, Save, Sell, Chats, You, Requests, Claim or Bid opens a **blurred-backdrop auth modal** that shows the tapped product, a reason line, Continue with Google, the email OTP form, the CAPTCHA, and a Sign in / Create account toggle. After auth, resume the action they wanted.
- Google: Auth.js Google provider with `hd=iimidr.ac.in` AND a server `signIn` callback that rejects other domains (`hd` is only a hint).
- First login: one-screen onboarding with hostel chips, room and optional WhatsApp. Skip is allowed.
- **Demo accounts:** Resend can only email unverified addresses after you verify a sending domain. Verify a domain for the real flow. For the presentation, also seed two accounts (`demo.buyer@iimidr.ac.in`, `demo.seller@iimidr.ac.in`) and allow `DEMO_OTP=246810` **only when `DEMO_MODE=true`**, with a visible "Demo mode" pill in the header. Say this honestly in Q&A.

### 6.2 Home
1. **Hero:** a carousel taking about two thirds of the width, with 7 slides:
   - Preprocess (hourly rentals)
   - Big brands up to 70% off
   - Garba Night & Diwali
   - Live auctions
   - Food drops in your hostel
   - Placement formals
   - Gym Corner

   It auto-advances every 6 s and pauses on hover or when an overlay is open. On desktop there are 2 side cards:
   - "Moving out? Sell or rent it out in a minute", showing the most-wanted open request
   - "Can't find it? Post I am looking for a...", which swaps to "Rate N finished deals" when ratings are pending
2. **Ending soon board** (time-sensitive, one tap):
   - Food drops in your hostel: price, hostel, countdown, Claim.
   - Live auctions: top bid, bids, original price, countdown, "Bid ₹next".
   - Timers turn amber, then red (drops under 10 min, auctions under 1 h).
   - Guests see a locked food-drop panel.
3. Reassurance strip: Only IIM Indore, Pay at handover, Pickup from your hostel, Ratings after every deal.
4. Shop by category tiles (desktop) / category stories (mobile).
5. "Shop by moment" collections:
   - Freshers' starter kit
   - Move-out sale
   - Placement season
   - Fest season · ARB (Atharv Ranbhoomi, the college fest: sports kit, cameras, speakers only; no ethnic wear, no decor)
   - Garba Night, Diwali, Holi, Secret Santa (gifts under ₹500)

   Cultural festivals and the college fest are separate.
6. Rails (one clean row on desktop with "See all"): Big brands, Preprocess, Gym Corner, Novels & manga, Rent don't buy. Then People are looking for, Fresh near you.

### 6.3 Categories (seed; admin-editable later)
- **Seasons:**
  - Preprocess Store (hourly rentals for club/committee preprocesses)
  - Placement Formals (suits, blazers, shoes, belts)
  - Ethnic & Festive (kurtas, sarees, chaniya cholis, dandiya)
  - Fest & Event Gear (for ARB and club events: cameras, speakers, lights, props)
- **Study:**
  - Books & Stationery
  - CFA, CAT & Exam Prep (Arun Sharma QA, LRDI, VA; Casio fx-991ES Plus, fx-991EX, fx-82MS, fx-100MS, FC-200V; BA II Plus; bundles)
  - Laptops & Gadgets
- **Hostel life:**
  - Room & Hostel (including Water Science shower filters)
  - Appliances & Kitchen
  - Food Drops (hostel-only)
  - Free & Giveaways
- **Play:**
  - Gym Corner (supplements and personal gear only: the campus gym has the machines. Supplements need Seal and Expiry.)
  - Sports Gear (Yonex Astrox 77 Pro, Nanoflare 700, Arcsaber 11 Pro, Nanoray Light 18i...)
  - Music, Games & Hobbies
  - Novels, Comics & Manga (Harry Potter, One Piece, Naruto, Death Note, AoT, JJK, Sapiens, Atomic Habits..., buy or weekly rent)
  - Cycles & Travel
  - Clothing & Accessories (Ray-Ban Wayfarer RB2140 / Aviator RB3025, Nike AF1, Adidas Ultraboost, Tommy/Levi's/Hidesign belts, Apple Watch SE, Galaxy Watch4, G-Shock GA-2100, Fossil, Titan, JBL Go 3, Marshall Emberton II, boAt Stone 1200, Sony XB13)
  - Tickets (no train or flight tickets)

### 6.4 Listing details
- **Value check on every second-hand item:** sell, rent and auction listings require an original price and a purchase month. Cards show:
  - asking price
  - the struck-out original price
  - % off in green
  - the colour-coded age badge (<6 mo green #15803D, 6 to 18 mo teal #02637A, 18 to 36 mo amber #E0A526, 3+ yrs red #C2372C)

  Rentals show "Worth ₹X new". Brand and Model come first in the specs.
- **Specs / size** on every listing, adapting to the item (clothing sizes + inches, UK shoe sizes, suit jacket/waist/length/fit, gym net weight/servings, book edition/pages, L×W×H/weight/capacity).
- **Bundles:** either the seller's own listings linked together, or a free-text contents list. "Save ₹X vs separately"; "Frequently bought together" on each part.
- **Hourly slots (Preprocess):** 14 day tiles with a booked-share bar, then a 24 h timeline in 4 rows (Night, Morning, Afternoon, Evening). Booked hours are striped, past hours are faded, and a range can't cross a booking. The cost box shows the times. Saved in `rental_bookings` with a `tstzrange` exclusion constraint.
- **Rent by day/week/month:** a 14-day strip picker, a cost breakdown, "Request to rent".
- **Sale:** Buy now (pickup time chips, nothing charged), Make an offer, Chat.
- **Auction:**
  - Timer, current bid, one-tap bids, custom amount, optional Buy it now, bid history.
  - `place_bid` RPC with row lock, and 2 min anti-sniping.
  - The seller can sell to any bidder or end the auction without selling.
- **Food drops are HOSTEL-ONLY** (enforced in RLS):
  - Visible only when the viewer's hostel equals the seller's.
  - Copy says so everywhere: "Food drops in Hostel 4 · only people in Hostel 4 can see these".
  - "Hostel-only drop" badge on the item page.
  - The sell flow skips the category and the title label reads "What are you sharing?".
  - Claim is atomic (first come, first served) and drops auto-expire.

### 6.5 Requests, chat, deals, ratings, Plume, Mayu, notifications
- **Requests board:** composer with needed-by chips, upvote "need this", sort tabs, offers with photo/price, Accept. Full CRUD for owners (section 1.4).
- **Chat:**
  - Desktop dock + pop-up windows, a full-screen thread on phones.
  - Item context strip, a deal bar once agreed, structured offers (Accept / Decline / Counter), quick replies.
  - Supabase Realtime, optimistic sends, read receipts.
- **Deals:** tabs and a step tracker (Sale: Agreed → Handed over → Rate; Rental: Agreed → Picked up → Returned → Rate), with handover check modals.
- **Ratings:**
  - Anchors -10 / -5 / 0 / +5 / +10, a slider and tags.
  - A **required reason of 10 to 500 characters**.
  - A live Plume preview. Both sides rate, and ratings can be edited within 24 h.
- **Plume (trust):** `delta = K(n)·(r/10)·w`, with K = max(6, 40/√(1+n/3)) and w = clamp(1+raterPlume/400, 0.5, 1.5).
  - Applied by a Postgres trigger with a row lock.
  - Levels in words: New, Building trust, Trusted, Top rated, Mixed reviews, Flagged.
  - Anti-gaming rules. Vitest table tests.
- **Mayu:**
  - `POST /api/mayu` with AI SDK `streamText`, `gpt-4o`, temperature 0.3.
  - Read-only tools (`search_listings`, `get_listing`, `list_open_requests`, `explain_plume`, `get_my_stats`). Results render as cards built from tool data, never from model text.
  - Compares rent vs buy sensibly. No results means it offers to post a request.
  - Rate limit 30/hour.
- **Notifications:** outbid, offers, request replies, food drop in your hostel, price drop on saved items, return due, rating received. Bell + Resend emails, respecting user toggles.
- **Safety:** report listings, messages and users; `/admin` to hide or ban; payments are always "UPI or cash at handover".

---

## 7. Stack

- **Next.js 15** (App Router, Server Components, Server Actions, TypeScript strict, `src/`)
- **Supabase**: Postgres, Realtime, RLS, `pg_cron` (auction/drop expiry, hard-delete purge)
- **Auth.js v5**: Google provider (domain-locked) + custom email OTP credentials, JWT sessions
- **Cloudflare Turnstile** for CAPTCHA (`@marsidev/react-turnstile`), switchable to hCaptcha or reCAPTCHA v2
- **Resend + React Email**; **Cloudinary** signed uploads (`next-cloudinary`)
- **OpenAI** `gpt-4o` via the Vercel AI SDK (`ai`, `@ai-sdk/openai`)
- **Tailwind v4** + **shadcn/ui** (Dialog, AlertDialog, DropdownMenu, Sheet, Table, Toast via `sonner`) + `vaul` + `lucide-react`
- **Zod + React Hook Form** (shared schemas), **TanStack Table** (My listings), **TanStack Query** (realtime caches), `dnd-kit` (photo reorder)
- **Upstash Ratelimit** (or a Postgres rate-limit table) for OTP, login, create-listing and Mayu
- **Vitest**, **Playwright**; `pnpm`; deploy to Vercel + Supabase cloud

---

## 8. Database (Supabase migrations, RLS on every table, comment every object)

- `profiles(id uuid pk, email citext unique check (email ~ '@iimidr\.ac\.in$'), name, hostel, room, whatsapp, show_whatsapp, avatar_url, avatar_public_id, plume numeric(8,2) default 0, rated_deals int default 0, role text default 'user', banned bool default false, deleted_at, created_at)`
- `email_otps(id, email, code_hash, expires_at, attempts, ip, created_at)`
- `captcha_logs(id, action, ip, success bool, error_codes text[], created_at)` (helps debug and shows a security dashboard in admin)
- `categories(id text pk, name, short_name, group, description, cover_url, sort)` and `collections(id, name, description, rule jsonb)`
- `listings`:
  - `id uuid`, `seller_id`, `category_id`, `mode enum('sell','rent','auction','drop')`, `title`, `description`, `condition enum`
  - `price int`, `mrp int`, `rent_unit enum('hour','day','week','month')`, `deposit int`, `reserve_price int`, `buy_now_price int`, `ends_at`
  - `status enum('active','paused','sold','closed','expired','hidden','deleted')`
  - `brand`, `model`, `size`, `specs jsonb`, `purchased_on date`, `seal_status`, `expires_on`, `is_bundle`, `bundle_contents text[]`
  - `pickup_hostel`, `tags text[]`, `search tsvector generated`, `views int`, `saves int`
  - `deleted_at timestamptz null`, `created_at`, `updated_at` (trigger keeps it current)

  CHECKs per mode:
  - `mrp >= price`
  - auction needs `reserve_price` + `ends_at`
  - rent needs a rate, a unit and a deposit
  - drop needs `ends_at` and category `food`
  - `purchased_on <= current_date`
- `listing_images(id, listing_id, public_id, url, position)`
- `listing_price_history(id, listing_id, old_price, new_price, changed_by, created_at)`
- `audit_log(id, actor_id, entity, entity_id, action enum('create','update','delete','restore'), before jsonb, after jsonb, created_at)`
- `rental_bookings(id, listing_id, renter_id, period tstzrange, status)` with `EXCLUDE USING gist (listing_id WITH =, period WITH &&)`
- `bids` + `place_bid()` RPC; `close_auction()` RPC; a `pg_cron` minute job to expire auctions and drops; a daily job to purge soft-deleted rows older than 30 days
- `requests(..., needed_by, status enum('open','found','deleted'), deleted_at)`, `request_replies(..., deleted_at)`, `request_votes`
- `conversations`, `messages(kind enum('text','offer','system'), offer_amount, offer_status, read_at)`
- `transactions(..., stage smallint)`, `handover_checks`, `ratings(score check -10..10, reason check 10..500 chars, tags text[], plume_before, plume_after, delta, editable_until)`
- `saved_items`, `saved_searches`, `notifications`, `reports`, `ai_conversations`

**RLS (the server-side safety net for CRUD):**
- `listings` select:
  - `status='active' and deleted_at is null`, OR you are the owner
  - plus for `mode='drop'`, the viewer's hostel must equal `pickup_hostel`
- `listings` insert: `seller_id = auth.uid()`
- `listings` update and delete: `seller_id = auth.uid()` (or admin). Updates can't change `seller_id`; mode-lock rules live in a `BEFORE UPDATE` trigger that raises clear errors.
- Messages: readable only by the two members. Ratings: insert only by a party of a completed transaction, once.
- Phone/WhatsApp: visible only with `show_whatsapp` and an existing conversation.

Generate types into `src/lib/database.types.ts`. `supabase/seed.sql` seeds the categories, ~100 listings, requests, users and the two demo accounts from the prototype. Add `pnpm db:reset-demo` to restore the demo data in one command before presenting.

---

## 9. Project structure

```
src/
  app/
    (auth)/login/page.tsx                    [RUBRIC:AUTH] [RUBRIC:CAPTCHA]
    (shop)/layout.tsx                        header, category bar, live ticker, dock, Mayu
    (shop)/page.tsx                          home
    (shop)/browse/page.tsx                   [RUBRIC:DATA-DISPLAY] search/sort/filter
    (shop)/item/[id]/page.tsx                [RUBRIC:CRUD-READ]
    (shop)/sell/page.tsx                     [RUBRIC:CRUD-CREATE]
    (shop)/listings/[id]/edit/page.tsx       [RUBRIC:CRUD-UPDATE] + delete danger zone
    (shop)/my-listings/page.tsx              [RUBRIC:CRUD-READ] [RUBRIC:DATA-DISPLAY] table + bulk delete
    (shop)/requests/..., deals/, messages/, account/, u/[id]/
    admin/...
    api/auth/[...nextauth]/route.ts, api/mayu/route.ts, api/cloudinary/sign/route.ts, api/supabase-token/route.ts
  features/
    auth/        (otp-form.tsx, google-button.tsx, actions.ts, schema.ts)
    captcha/     (captcha.tsx, verify.ts)
    listings/    (listing-form/, actions/create.ts, actions/update.ts, actions/delete.ts, actions/restore.ts,
                  my-listings-table.tsx, delete-dialog.tsx, schema.ts, queries.ts)
    browse/, requests/, chat/, auctions/, deals/, plume/, mayu/
  components/ui/ (button, input, field-error, dialog, alert-dialog, dropdown, table, sheet, toast)
  lib/ (auth.ts, supabase/, validation/, security/ratelimit.ts, cloudinary.ts, resend.ts, utils.ts, action-result.ts)
supabase/ (migrations/, seed.sql)
tests/ (unit/, e2e/)
docs/ (RUBRIC.md, ARCHITECTURE.md, DEMO.md)
```

---

## 10. Environment variables (`.env.example`, every line commented)

```
NEXTAUTH_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAIL_DOMAIN=iimidr.ac.in
CAPTCHA_PROVIDER=turnstile              # turnstile | hcaptcha | recaptcha | off (off only in dev)
NEXT_PUBLIC_CAPTCHA_SITE_KEY=           # Turnstile test key on localhost: 1x00000000000000000000AA
CAPTCHA_SECRET_KEY=                     # Turnstile test secret: 1x0000000000000000000000000000000AA
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
RESEND_API_KEY=
RESEND_FROM="i-bay <no-reply@yourdomain>"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
DEMO_MODE=false                         # true only for the presentation build
DEMO_OTP=246810
```

---

## 11. Quality bar

- Server Components by default; client components only for interactive pieces.
- Every mutation goes through a Server Action with session check → CAPTCHA (where listed) → Zod → ownership → DB → `revalidatePath`. Never trust client prices, ids or owner fields.
- Money as integer rupees; times stored UTC, shown in `Asia/Kolkata`.
- Accessibility: labels, `aria-invalid`, focus trapping, Escape closes dialogs, 4.5:1 contrast, keyboard-usable menus and tables.
- Loading skeletons, empty states with a call to action, `error.tsx` per route group, toasts with actions ("Deleted. Undo").
- `next/image` with the Cloudinary loader, lazy rails, cursor pagination.
- Performance: Lighthouse at least 90 on mobile for Home and Browse (screenshot it for the README).

---

## 12. Presentation plan (7 to 8 minutes including Q&A) → `docs/DEMO.md`

**Before you present**
- Run `pnpm db:reset-demo`.
- Open these tabs and log the right accounts in:
  - Tab 1: Home (logged out)
  - Tab 2: seller account
  - Tab 3: buyer account in a private window, for the realtime bid
- Zoom to 125% and turn on light mode first.
- Keep a localhost build and a 2-minute screen recording as backups.

**Script (about 5:30, leaving about 2 min for Q&A)**

| Time | Show | Rubric |
|---|---|---|
| 0:00 to 0:20 | One line: "i-bay is IIM Indore's own second-hand marketplace: buy, rent, bid, and food drops inside your hostel." Home page. | Clarity |
| 0:20 to 1:20 | Login: Gmail rejected, then the CAPTCHA (fail without it), then the campus email OTP. Land back where you were. | Auth, CAPTCHA |
| 1:20 to 2:00 | Validation: try to post with an empty title, a price above the original and a future purchase date (inline errors). Then `?novalidate=1` to show the server rejecting the same data. | Validation |
| 2:00 to 3:40 | CRUD on a listing: create one, find it in browse and in My listings (table), inline price edit (price-dropped badge), full edit, try another user's edit URL (404), delete with Undo, delete again, bulk delete. | CRUD 40% |
| 3:40 to 4:20 | Browse: search "yonex", filter by mode/hostel/age, sort by biggest discount; My listings column sort. | Data display |
| 4:20 to 5:00 | Extras: live auction bid from the second window updating instantly, the hourly preprocess timeline, hostel-only food drop, Mayu answering "cheapest fx-991ES". | Innovation |
| 5:00 to 5:30 | Responsive: device toolbar (phone and tablet), toggle dark mode. | UI/UX |

**Likely Q&A (prepare short answers in DEMO.md):**
- How is a password-less login secure?
- What exactly does the CAPTCHA stop?
- Why validate twice?
- What stops me deleting someone else's listing? (Server check + RLS.)
- Why soft delete?
- How do you stop two people booking the same hour? (Exclusion constraint.)
- How is Plume calculated?
- Does the AI ever make up listings? (No, cards come from tool results only.)
- Why no online payments?
- What would you build next?

**Playwright `e2e/demo.spec.ts`** runs this exact script so you know it passes the night before.

---

## 13. Build phases (graded basics first)

1. **Scaffold:** tokens, fonts, icons, `<Peacock />`, responsive shell (phone tab bar, desktop header + category bar), theme toggle top right, footer.
2. **Database:** schema, RLS, triggers, seed, demo reset script, generated types.
3. **Auth + CAPTCHA:** Google (domain-locked), email OTP, Turnstile on login/signup/resend, rate limits, middleware, onboarding, account settings, demo mode.
4. **Validation layer:** shared Zod schemas, `ActionResult`, `FieldError` components, unit tests for every schema.
5. **Listings CRUD:**
   - Create (3-step form with CAPTCHA, Cloudinary, live preview)
   - Read (item page, browse with search/sort/filter)
   - Update (edit page, mode locks, concurrency check, price history)
   - Delete (confirm dialog, soft delete + undo, guards, bulk)
   - **My listings** table with sort/filter/search/pagination
   - Audit log
6. **Requests CRUD**, saved items, profile update/delete.
7. **Responsive + UX polish** to match the prototype on phone, tablet and desktop; accessibility pass; Lighthouse.
8. **Rentals:** day strip and hourly timeline with exclusion constraints.
9. **Auctions** (realtime, anti-sniping, close to any bidder) and **food drops** (hostel-only RLS, claim, expiry, live ticker, ending soon board).
10. **Chat dock**, structured offers, deals, handovers, ratings, Plume.
11. **Mayu**, notifications, reports/admin.
12. **Docs:** README, RUBRIC.md, ARCHITECTURE.md, DEMO.md, the demo Playwright spec, and the Vercel deploy.

Start with phase 1. Before coding, open `prototype/index.html`, list the components you'll create, confirm the token mapping, and show me the folder tree.
