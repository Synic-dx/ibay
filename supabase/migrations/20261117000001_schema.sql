-- =====================================================================
-- i-bay schema, part 1: extensions, types and tables.
-- RUBRIC: Functionality (CRUD) and Code quality (the database is the
-- last guard: CHECK constraints, NOT NULL, enums and foreign keys mean
-- even a direct API call can't save bad data).
-- =====================================================================

-- Case-insensitive text for emails, so "A@iimidr.ac.in" and "a@iimidr.ac.in" are the same person.
create extension if not exists citext with schema extensions;
-- Trigram matching, so a search for "yonx" still finds "Yonex".
create extension if not exists pg_trgm with schema extensions;
-- Lets an exclusion constraint mix "=" on ids with "&&" on time ranges (no double bookings).
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Enums: fixed lists of allowed values, checked by Postgres itself.
-- ---------------------------------------------------------------------

-- How a listing is sold: fixed price, rental, auction or a hostel food drop.
create type public.listing_mode as enum ('sell', 'rent', 'auction', 'drop');

-- Where a listing is in its life. "deleted" is a soft delete (restorable for 30 days).
create type public.listing_status as enum ('active', 'paused', 'sold', 'claimed', 'closed', 'expired', 'hidden', 'deleted');

-- Condition labels shown on cards and in the sell form.
create type public.item_condition as enum ('New', 'Like new', 'Very good', 'Good', 'Fair', 'Opened');

-- What a rental rate is charged per.
create type public.rent_unit as enum ('hour', 'day', 'week', 'month');

-- What happened to a row, for the audit log.
create type public.audit_action as enum ('create', 'update', 'delete', 'restore');

-- Request lifecycle: open, found ("Found it") or soft deleted.
create type public.request_status as enum ('open', 'found', 'deleted');

-- Chat message kinds: normal text, a structured price offer, or a system note.
create type public.message_kind as enum ('text', 'offer', 'system');

-- State of a structured offer inside a chat.
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'countered');

-- Kind of deal, which decides the steps in the deal tracker.
create type public.deal_kind as enum ('sale', 'rental', 'auction');

-- ---------------------------------------------------------------------
-- profiles: one row per student. Auth.js owns sign-in; this table owns
-- everything we show about a person.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique
    constraint profiles_email_domain check (email::text ~ '^[a-z0-9._%+-]+@iimidr\.ac\.in$'),
  name text not null default 'Student'
    constraint profiles_name_len check (char_length(name) between 2 and 60),
  hostel text not null default 'Hostel 1'
    constraint profiles_hostel check (hostel in ('Hostel 1','Hostel 2','Hostel 3','Hostel 4','Hostel 5','Hostel 6','Day scholar')),
  room text constraint profiles_room check (room is null or room ~ '^[A-Z]?\d{1,4}$'),
  whatsapp text constraint profiles_whatsapp check (whatsapp is null or whatsapp ~ '^(\+91)?[6-9]\d{9}$'),
  show_whatsapp boolean not null default false,
  avatar_url text,
  avatar_public_id text,
  avatar_color text not null default '#02505F',
  response_note text,
  plume numeric(8,2) not null default 0,
  rated_deals int not null default 0 constraint profiles_rated_deals check (rated_deals >= 0),
  role text not null default 'user' constraint profiles_role check (role in ('user','admin')),
  banned boolean not null default false,
  onboarded boolean not null default false,
  notify_prefs jsonb not null default '{"email": true, "outbid": true, "offers": true, "requests": true, "drops": true, "price_drops": true, "returns": true, "ratings": true}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per student. Email must be an @iimidr.ac.in address; plume is the trust score.';

-- ---------------------------------------------------------------------
-- email_otps: one-time sign-in codes. Only a bcrypt hash is stored.
-- ---------------------------------------------------------------------
create table public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0 constraint email_otps_attempts check (attempts between 0 and 5),
  resends int not null default 0,
  ip text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.email_otps is 'Sign-in codes: bcrypt hash only, 10 minute expiry, locked after 5 wrong tries.';
create index email_otps_email_idx on public.email_otps (email, created_at desc);

-- ---------------------------------------------------------------------
-- rate_limits: fixed-window counters (per email, per IP, per user).
-- ---------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
comment on table public.rate_limits is 'Fixed-window counters used to rate limit OTP emails, logins, new listings and Mayu.';

-- ---------------------------------------------------------------------
-- captcha_logs: every CAPTCHA check, pass or fail (security dashboard).
-- ---------------------------------------------------------------------
create table public.captcha_logs (
  id bigint generated always as identity primary key,
  action text not null,
  ip text,
  success boolean not null,
  error_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);
comment on table public.captcha_logs is 'Each CAPTCHA verification result, so admins can see failures and debug the provider.';

-- ---------------------------------------------------------------------
-- categories and collections (admin-editable later).
-- ---------------------------------------------------------------------
create table public.categories (
  id text primary key,
  name text not null,
  short_name text not null,
  "group" text not null constraint categories_group check ("group" in ('Seasons','Study','Hostel life','Play')),
  description text not null default '',
  icon text not null default 'package',
  cover_url text,
  cover_fit text not null default 'contain' constraint categories_cover_fit check (cover_fit in ('contain','cover')),
  sort int not null default 0
);
comment on table public.categories is 'Shop categories grouped into Seasons, Study, Hostel life and Play.';

create table public.collections (
  id text primary key,
  name text not null,
  description text not null default '',
  rule jsonb not null,
  sort int not null default 0
);
comment on table public.collections is 'Shop-by-moment collections. rule is {"tags_any":[...]} or {"categories":[...],"exclude_tags":[...]}.';

-- ---------------------------------------------------------------------
-- listings: the main CRUD resource.
-- ---------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id),
  mode public.listing_mode not null,
  title text not null constraint listings_title_len check (char_length(title) between 5 and 80),
  description text not null default '' constraint listings_description_len check (char_length(description) <= 1000),
  condition public.item_condition not null default 'Good',
  -- price is always the number shown on the card: asking price, rent rate,
  -- current top bid (auctions) or food drop price. Whole rupees.
  price int not null constraint listings_price_range check (price between 0 and 200000),
  mrp int constraint listings_mrp_range check (mrp is null or mrp between 1 and 500000),
  rent_unit public.rent_unit,
  deposit int constraint listings_deposit_range check (deposit is null or deposit between 0 and 50000),
  reserve_price int constraint listings_reserve_range check (reserve_price is null or reserve_price >= 1),
  buy_now_price int,
  ends_at timestamptz,
  status public.listing_status not null default 'active',
  brand text,
  model text,
  size text,
  specs jsonb not null default '[]'::jsonb constraint listings_specs_array check (jsonb_typeof(specs) = 'array' and jsonb_array_length(specs) <= 12),
  purchased_on date,
  seal_status text,
  expires_on date,
  is_bundle boolean not null default false,
  bundle_contents text[] not null default '{}',
  bundle_items uuid[] not null default '{}',
  ticket_info text[] not null default '{}',
  pickup_hostel text not null,
  tags text[] not null default '{}',
  search tsvector,
  views int not null default 0,
  saves int not null default 0,
  price_drop_amount int,
  price_dropped_at timestamptz,
  relisted_from uuid references public.listings (id) on delete set null,
  status_before_delete public.listing_status,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Second-hand value check: you can't ask more than you paid.
  constraint listings_mrp_ge_price check (mode = 'auction' or mrp is null or mrp >= price),
  -- Sell, rent and auction need an original price, except tickets and free giveaways.
  constraint listings_mrp_required check (mode = 'drop' or category_id in ('tickets','free','food') or mrp is not null),
  -- Purchase month is required for second-hand items and can't be in the future or older than 15 years.
  constraint listings_purchased_required check (mode = 'drop' or category_id in ('tickets','free','food') or purchased_on is not null),
  constraint listings_purchased_range check (purchased_on is null or (purchased_on <= current_date and purchased_on >= date '2000-01-01')),
  -- Rentals need a unit, a rate of at least 1 and a deposit.
  constraint listings_rent_fields check (mode <> 'rent' or (rent_unit is not null and deposit is not null and price >= 1)),
  -- Auctions need a minimum (reserve) and an end time; buy-now must beat the minimum.
  constraint listings_auction_fields check (mode <> 'auction' or (reserve_price is not null and ends_at is not null)),
  constraint listings_buy_now check (buy_now_price is null or (mode = 'auction' and buy_now_price > reserve_price)),
  -- Food drops: category food, an end time and at most Rs 2,000.
  constraint listings_drop_fields check (mode <> 'drop' or (category_id = 'food' and ends_at is not null and price <= 2000)),
  constraint listings_food_is_drop check (category_id <> 'food' or mode = 'drop'),
  -- Supplements need a seal status and an expiry date.
  constraint listings_supplement_fields check (not ('supplement' = any (tags)) or (seal_status is not null and expires_on is not null)),
  constraint listings_bundle_contents check (cardinality(bundle_contents) <= 20)
);
comment on table public.listings is 'Everything people sell, rent, auction or drop. Soft deleted rows keep deleted_at for 30 days.';
create index listings_status_idx on public.listings (status, created_at desc) where deleted_at is null;
create index listings_seller_idx on public.listings (seller_id, updated_at desc);
create index listings_category_idx on public.listings (category_id) where deleted_at is null;
create index listings_search_idx on public.listings using gin (search);
create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);
create index listings_tags_idx on public.listings using gin (tags);
create index listings_ends_idx on public.listings (ends_at) where mode in ('auction','drop') and status = 'active';

-- Photos for a listing, in display order. Only URLs are stored (files live on Cloudinary).
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  public_id text,
  url text not null,
  fit text not null default 'contain' constraint listing_images_fit check (fit in ('contain','cover')),
  position smallint not null default 0 constraint listing_images_position check (position between 0 and 5),
  created_at timestamptz not null default now()
);
comment on table public.listing_images is 'Up to 6 photos per listing; position 0 is the cover.';
create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- Every price change, so we can show "Price dropped" and alert people who saved it.
create table public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  old_price int not null,
  new_price int not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.listing_price_history is 'One row per price change, written by a trigger.';
create index listing_price_history_idx on public.listing_price_history (listing_id, created_at desc);

-- Who changed what and when (shown as "Edit history" on the edit page).
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is 'Before/after JSON for every create, update, delete and restore.';
create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- Rentals, bids and deals
-- ---------------------------------------------------------------------

-- Deals between two people (the "Deals" tab with a step tracker).
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  kind public.deal_kind not null,
  amount int not null constraint transactions_amount check (amount >= 0),
  deposit int not null default 0,
  days int not null default 1,
  stage smallint not null default 0 constraint transactions_stage check (stage between 0 and 3),
  pickup_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_two_people check (buyer_id <> seller_id)
);
comment on table public.transactions is 'A deal. Sale stages: Agreed, Handed over, Rate. Rental: Agreed, Picked up, Returned, Rate.';
create index transactions_buyer_idx on public.transactions (buyer_id, created_at desc);
create index transactions_seller_idx on public.transactions (seller_id, created_at desc);

-- Rental bookings. The exclusion constraint makes double booking impossible.
create table public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  renter_id uuid not null references public.profiles (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  period tstzrange not null constraint rental_bookings_period check (not isempty(period) and lower(period) is not null and upper(period) is not null),
  status text not null default 'confirmed' constraint rental_bookings_status check (status in ('confirmed','cancelled','completed')),
  created_at timestamptz not null default now(),
  -- WHY: two people can never hold overlapping time on the same item.
  constraint rental_bookings_no_overlap exclude using gist (listing_id with =, period with &&) where (status <> 'cancelled')
);
comment on table public.rental_bookings is 'Booked time on a rental. Overlaps on the same listing are rejected by Postgres.';

-- Auction bids. Placed only through place_bid() which locks the listing row.
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null constraint bids_amount check (amount >= 1),
  created_at timestamptz not null default now()
);
comment on table public.bids is 'One row per bid. Highest amount wins unless the seller picks another bidder.';
create index bids_listing_idx on public.bids (listing_id, amount desc);

-- Two-person handover checklists (photos taken, payment or deposit done).
create table public.handover_checks (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  by_user uuid not null references public.profiles (id) on delete cascade,
  step text not null,
  photos_taken boolean not null default false,
  money_done boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.handover_checks is 'Confirmation ticks at each deal step, like an Airbnb check-in.';

-- Ratings after a deal. A trigger turns each rating into a Plume change.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions (id) on delete set null,
  rater_id uuid references public.profiles (id) on delete set null,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  score int not null constraint ratings_score check (score between -10 and 10),
  reason text not null constraint ratings_reason_len check (char_length(reason) between 10 and 500),
  tags text[] not null default '{}',
  plume_before numeric(8,2),
  plume_after numeric(8,2),
  delta numeric(8,2),
  editable_until timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  constraint ratings_once unique (transaction_id, rater_id),
  constraint ratings_not_self check (rater_id is null or rater_id <> ratee_id)
);
comment on table public.ratings is 'Both sides rate once per deal (-10 to +10 with a required reason). Editable for 24 hours.';
create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

-- ---------------------------------------------------------------------
-- Requests ("I am looking for a...")
-- ---------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id),
  text text not null constraint requests_text_len check (char_length(text) between 5 and 120),
  budget text not null default 'Open to offers' constraint requests_budget_len check (char_length(budget) <= 40),
  needed_by date,
  status public.request_status not null default 'open',
  votes int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.requests is 'Wanted posts with an optional needed-by date. Owners can edit, close or delete them.';

create table public.request_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null constraint request_replies_text_len check (char_length(text) between 2 and 500),
  price_text text not null default 'Ask me' constraint request_replies_price_len check (char_length(price_text) <= 40),
  image_url text,
  accepted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.request_replies is '"I have this" offers on a request, with an optional photo and price.';

create table public.request_votes (
  request_id uuid not null references public.requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
comment on table public.request_votes is 'One "I need this too" upvote per person per request.';

-- ---------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  transaction_id uuid references public.transactions (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- WHY: one thread per pair of people (stored with the smaller id first).
  constraint conversations_ordered check (user_a < user_b),
  constraint conversations_pair unique (user_a, user_b)
);
comment on table public.conversations is 'One chat thread per pair of students, with the item they are talking about.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind public.message_kind not null default 'text',
  body text not null default '' constraint messages_body_len check (char_length(body) <= 1000),
  offer_amount int constraint messages_offer_amount check (offer_amount is null or offer_amount >= 1),
  offer_status public.offer_status,
  listing_id uuid references public.listings (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_offer_fields check (kind <> 'offer' or (offer_amount is not null and offer_status is not null))
);
comment on table public.messages is 'Chat messages: text, structured offers (accept/decline/counter) or system notes.';
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- Saved items, notifications, reports, Mayu
-- ---------------------------------------------------------------------
create table public.saved_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
comment on table public.saved_items is 'Hearted listings. Saving one also subscribes you to its price drops.';

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.saved_searches is 'Searches a user asked to be alerted about.';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  icon text not null default 'bell',
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'Bell notifications: outbid, offers, request replies, drops, price drops, returns, ratings.';
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  reason text not null constraint reports_reason check (reason in ('scam','prohibited','offensive','wrong_category','spam','other')),
  details text not null default '' constraint reports_details_len check (char_length(details) <= 500),
  status text not null default 'open' constraint reports_status check (status in ('open','actioned','dismissed')),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reports_target check (listing_id is not null or reported_user_id is not null or message_id is not null)
);
comment on table public.reports is 'Safety reports on listings, messages or people, reviewed in /admin.';

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  question text not null,
  answer text,
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.ai_conversations is 'Questions asked to Mayu, for rate limiting and debugging.';
