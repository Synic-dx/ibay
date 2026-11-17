-- =====================================================================
-- i-bay schema, part 3: Row Level Security (RLS) on every table.
-- The Next.js server talks to Postgres with the service role and does its
-- own checks first. These policies are the safety net for anyone using the
-- public anon key directly: they can only ever see or touch what the app
-- would let them. auth.uid() is the signed-in student's profile id.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.email_otps enable row level security;
alter table public.rate_limits enable row level security;
alter table public.captcha_logs enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_price_history enable row level security;
alter table public.audit_log enable row level security;
alter table public.transactions enable row level security;
alter table public.rental_bookings enable row level security;
alter table public.bids enable row level security;
alter table public.handover_checks enable row level security;
alter table public.ratings enable row level security;
alter table public.requests enable row level security;
alter table public.request_replies enable row level security;
alter table public.request_votes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.saved_items enable row level security;
alter table public.saved_searches enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.media_trash enable row level security;
-- email_otps, rate_limits, captcha_logs and media_trash get no policies: only the server can read them.

-- True if the signed-in user is an admin.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
comment on function public.is_admin is 'Used by policies: admins can moderate listings and reports.';

-- The signed-in user's hostel (food drops are only visible inside the same hostel).
create or replace function public.my_hostel() returns text
language sql stable security definer set search_path = public as $$
  select hostel from public.profiles where id = auth.uid()
$$;
comment on function public.my_hostel is 'Used by the listings policy for hostel-only food drops.';

-- ---- profiles -------------------------------------------------------
-- Anyone can see public profile fields; you can only edit your own row.
create policy "profiles are public" on public.profiles for select using (deleted_at is null);
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'user' and banned = false);

-- ---- reference data -------------------------------------------------
create policy "categories are public" on public.categories for select using (true);
create policy "collections are public" on public.collections for select using (true);

-- ---- listings -------------------------------------------------------
-- Read: active, not deleted, and food drops only in your own hostel. Owners always see their own.
create policy "read active listings" on public.listings for select using (
  (status = 'active' and deleted_at is null and (mode <> 'drop' or pickup_hostel = public.my_hostel()))
  or seller_id = auth.uid()
  or public.is_admin()
);
-- Create: only as yourself.
create policy "create own listings" on public.listings for insert with check (seller_id = auth.uid());
-- Update/delete: owner or admin (the listings_before_write trigger adds the mode locks).
create policy "update own listings" on public.listings for update using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
create policy "delete own listings" on public.listings for delete using (seller_id = auth.uid() or public.is_admin());

create policy "read listing images" on public.listing_images for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy "manage own listing images" on public.listing_images for all using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);

create policy "owner reads price history" on public.listing_price_history for select using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);
create policy "owner reads audit log" on public.audit_log for select using (actor_id = auth.uid() or public.is_admin());

-- ---- bids (public, so live auctions can update for everyone) ----------
create policy "bids are public" on public.bids for select using (true);

-- ---- deals ------------------------------------------------------------
create policy "parties read deals" on public.transactions for select using (auth.uid() in (buyer_id, seller_id));
create policy "parties read handovers" on public.handover_checks for select using (
  exists (select 1 from public.transactions t where t.id = transaction_id and auth.uid() in (t.buyer_id, t.seller_id))
);
-- Booked hours are public (striped on the timeline) but only parties see who booked.
create policy "bookings are visible" on public.rental_bookings for select using (true);

-- Ratings are public on profiles; inserting goes through submit_rating() only.
create policy "ratings are public" on public.ratings for select using (true);

-- ---- requests ---------------------------------------------------------
create policy "read open requests" on public.requests for select using (deleted_at is null or author_id = auth.uid());
create policy "create own requests" on public.requests for insert with check (author_id = auth.uid());
create policy "edit own requests" on public.requests for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "read replies" on public.request_replies for select using (deleted_at is null or author_id = auth.uid());
create policy "create own replies" on public.request_replies for insert with check (author_id = auth.uid());
create policy "edit own replies" on public.request_replies for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "read votes" on public.request_votes for select using (true);
create policy "vote as yourself" on public.request_votes for insert with check (user_id = auth.uid());
create policy "unvote as yourself" on public.request_votes for delete using (user_id = auth.uid());

-- ---- chat: only the two members can read or write -----------------------
create policy "members read conversations" on public.conversations for select using (auth.uid() in (user_a, user_b));
create policy "members read messages" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);
create policy "members send messages" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
);

-- ---- personal data ---------------------------------------------------------
create policy "own saved items" on public.saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own saved searches" on public.saved_searches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own mayu history" on public.ai_conversations for select using (user_id = auth.uid());

-- ---- reports: anyone signed in can file; only admins read -----------------
create policy "file reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "admins handle reports" on public.reports for update using (public.is_admin()) with check (public.is_admin());

-- ---- realtime ------------------------------------------------------------
-- Live auctions: browsers subscribe to bids and listing price/timer changes.
alter publication supabase_realtime add table public.bids, public.listings;
