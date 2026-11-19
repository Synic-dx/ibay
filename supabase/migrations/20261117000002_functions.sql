-- =====================================================================
-- i-bay schema, part 2: triggers and RPC functions.
-- Every function here runs as SECURITY DEFINER and is callable only by
-- the server (service role). Each one re-checks who is acting, so the
-- database repeats the rules the Server Actions already enforce.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------

-- Who is acting right now. Server Actions set this with set_config before writing.
create or replace function public.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('ibay.actor', true), '')::uuid
$$;
comment on function public.current_actor is 'The user id the server is acting for (set per transaction).';

-- True while a trusted system routine (bids, cron) is writing, so edit locks don't block it.
create or replace function public.is_system_write() returns boolean
language sql stable as $$
  select coalesce(current_setting('ibay.system', true), '') = 'on'
$$;
comment on function public.is_system_write is 'True inside place_bid, cron jobs and other system routines.';

-- Keeps updated_at current on any table that has one.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
comment on function public.touch_updated_at is 'Sets updated_at to now() on every update.';

-- Minimum step between bids: Rs 20 under 500, Rs 50 under 2,000, then Rs 100.
create or replace function public.bid_increment(v int) returns int
language sql immutable as $$
  select case when v < 500 then 20 when v < 2000 then 50 else 100 end
$$;
comment on function public.bid_increment is 'Bid step size, same rule as the client shows.';

-- ---------------------------------------------------------------------
-- Plume maths: delta = K(n) * (r/10) * w
--   K(n) = max(6, 40 / sqrt(1 + n/3))   (new members move fast, veterans slowly)
--   w    = clamp(1 + raterPlume/400, 0.5, 1.5)   (trusted raters count a bit more)
-- ---------------------------------------------------------------------
create or replace function public.plume_k(n int) returns numeric
language sql immutable as $$
  select greatest(6, 40 / sqrt(1 + n / 3.0))::numeric
$$;
comment on function public.plume_k is 'How far one rating can move a person with n rated deals.';

create or replace function public.plume_weight(rater_plume numeric) returns numeric
language sql immutable as $$
  select least(1.5, greatest(0.5, 1 + rater_plume / 400))
$$;
comment on function public.plume_weight is 'How much a rater''s own trust scales their rating.';

create or replace function public.plume_delta(n int, score int, rater_plume numeric) returns numeric
language sql immutable as $$
  select round(public.plume_k(n) * (score / 10.0) * public.plume_weight(rater_plume), 1)
$$;
comment on function public.plume_delta is 'The Plume change for one rating, rounded to 0.1.';

-- ---------------------------------------------------------------------
-- listings: search vector, edit locks, price drops
-- ---------------------------------------------------------------------

-- Builds the full-text search vector (title counts most, then brand/model, tags, description).
create or replace function public.listings_search_vector(l public.listings) returns tsvector
language sql immutable as $$
  select setweight(to_tsvector('simple', coalesce(l.title, '')), 'A')
      || setweight(to_tsvector('simple', coalesce(l.brand, '') || ' ' || coalesce(l.model, '')), 'B')
      || setweight(to_tsvector('simple', coalesce(array_to_string(l.tags, ' '), '')), 'C')
      || setweight(to_tsvector('simple', coalesce(l.description, '')), 'D')
$$;
comment on function public.listings_search_vector is 'Weighted tsvector used by browse search.';

-- BEFORE INSERT/UPDATE on listings. Enforces the edit rules even for direct database calls.
create or replace function public.listings_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  has_bids boolean;
  has_upcoming boolean;
begin
  new.search := public.listings_search_vector(new);

  if tg_op = 'INSERT' then
    return new;
  end if;

  new.updated_at := now();

  -- System routines (bids, expiry, buy-now) may change any field.
  if public.is_system_write() then
    return new;
  end if;

  -- 1. Nobody can move a listing to another owner.
  if new.seller_id <> old.seller_id then
    raise exception 'IBAY: You can''t change who owns a listing.' using errcode = 'P0001';
  end if;

  -- 2. The deal type is fixed once posted.
  if new.mode <> old.mode then
    raise exception 'IBAY: Deal type can''t be changed after posting. Delete this and list it again.' using errcode = 'P0001';
  end if;

  -- 3. Sold or ended listings are read-only (only delete/restore is allowed).
  if old.status in ('sold', 'claimed', 'closed', 'expired')
     and (new.title, new.description, new.price, new.mrp, new.category_id, new.condition, new.deposit, new.rent_unit, new.ends_at)
         is distinct from
         (old.title, old.description, old.price, old.mrp, old.category_id, old.condition, old.deposit, old.rent_unit, old.ends_at) then
    raise exception 'IBAY: Sold or ended listings are read-only. Use Relist to post a copy.' using errcode = 'P0001';
  end if;

  -- 4. Auctions with bids: starting bid and end time are locked.
  if old.mode = 'auction' then
    select exists (select 1 from public.bids b where b.listing_id = old.id) into has_bids;
    if has_bids and (new.reserve_price is distinct from old.reserve_price or new.ends_at is distinct from old.ends_at
                     or new.price is distinct from old.price or new.buy_now_price is distinct from old.buy_now_price) then
      raise exception 'IBAY: People have already bid, so the starting bid, buy-now price and end time are locked.' using errcode = 'P0001';
    end if;
  end if;

  -- 5. Rentals with upcoming bookings: the unit is locked (a rate change applies to new bookings only).
  if old.mode = 'rent' and new.rent_unit is distinct from old.rent_unit then
    select exists (
      select 1 from public.rental_bookings rb
      where rb.listing_id = old.id and rb.status = 'confirmed' and upper(rb.period) > now()
    ) into has_upcoming;
    if has_upcoming then
      raise exception 'IBAY: Someone has an upcoming booking, so the rental unit is locked.' using errcode = 'P0001';
    end if;
  end if;

  -- 6. Food drops: you may only extend the time (max 3 hours in total) or edit the description.
  if old.mode = 'drop' and old.status = 'active' then
    if (new.title, new.price, new.category_id) is distinct from (old.title, old.price, old.category_id) then
      raise exception 'IBAY: For a food drop you can only extend the time or edit the description.' using errcode = 'P0001';
    end if;
    if new.ends_at < old.ends_at then
      raise exception 'IBAY: A food drop''s time can only be extended.' using errcode = 'P0001';
    end if;
    if new.ends_at > old.created_at + interval '3 hours' then
      raise exception 'IBAY: Food drops can stay up for at most 3 hours in total.' using errcode = 'P0001';
    end if;
  end if;

  -- 7. Remember price drops for the "Price dropped" badge (shown for 7 days).
  if new.price < old.price and old.mode in ('sell', 'rent') then
    new.price_drop_amount := old.price - new.price;
    new.price_dropped_at := now();
  elsif new.price > old.price then
    new.price_drop_amount := null;
    new.price_dropped_at := null;
  end if;

  return new;
end $$;
comment on function public.listings_before_write is 'Edit locks for listings: owner, mode, sold/ended, auctions with bids, booked rentals, food drops.';

create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.listings_before_write();

-- AFTER UPDATE on listings: price history + alerts for people who saved it.
create or replace function public.listings_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price <> old.price and not public.is_system_write() then
    insert into public.listing_price_history (listing_id, old_price, new_price, changed_by)
    values (new.id, old.price, new.price, public.current_actor());

    -- WHY: saving an item subscribes you to price drops, so tell those people.
    if new.price < old.price and new.status = 'active' then
      insert into public.notifications (user_id, kind, icon, body, link)
      select s.user_id, 'price_drop', 'trend',
             'Price dropped by Rs ' || to_char(old.price - new.price, 'FM99,99,999') || ' on ' || new.title || '. Now Rs ' || to_char(new.price, 'FM99,99,999') || '.',
             '/item/' || new.id
      from public.saved_items s
      join public.profiles p on p.id = s.user_id
      where s.listing_id = new.id and s.user_id <> new.seller_id and coalesce((p.notify_prefs->>'price_drops')::boolean, true);
    end if;
  end if;
  return null;
end $$;
comment on function public.listings_after_update is 'Writes listing_price_history and price-drop notifications.';

create trigger listings_after_update
  after update on public.listings
  for each row execute function public.listings_after_update();

-- When a food drop is posted, tell people in the same hostel (only they can see it).
create or replace function public.listings_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'drop' then
    insert into public.notifications (user_id, kind, icon, body, link)
    select p.id, 'drop', 'flame', 'Food drop in ' || new.pickup_hostel || ': ' || new.title || ' for Rs ' || new.price || '.', '/item/' || new.id
    from public.profiles p
    where p.hostel = new.pickup_hostel and p.id <> new.seller_id and p.deleted_at is null
      and coalesce((p.notify_prefs->>'drops')::boolean, true);
  end if;
  return null;
end $$;
comment on function public.listings_after_insert is 'Notifies hostel-mates about a new food drop.';

create trigger listings_after_insert
  after insert on public.listings
  for each row execute function public.listings_after_insert();

-- ---------------------------------------------------------------------
-- Counters kept in sync by triggers
-- ---------------------------------------------------------------------

-- Keeps listings.saves equal to the number of saved_items rows.
create or replace function public.saved_items_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ibay.system', 'on', true);
  if tg_op = 'INSERT' then
    update public.listings set saves = saves + 1 where id = new.listing_id;
  else
    update public.listings set saves = greatest(0, saves - 1) where id = old.listing_id;
  end if;
  perform set_config('ibay.system', '', true);
  return null;
end $$;
comment on function public.saved_items_count is 'Updates the save counter shown in My listings.';

create trigger saved_items_count
  after insert or delete on public.saved_items
  for each row execute function public.saved_items_count();

-- Keeps requests.votes equal to the number of upvotes.
create or replace function public.request_votes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.requests set votes = votes + 1 where id = new.request_id;
  else
    update public.requests set votes = greatest(0, votes - 1) where id = old.request_id;
  end if;
  return null;
end $$;
comment on function public.request_votes_count is 'Updates the "need it" counter on a request.';

create trigger request_votes_count
  after insert or delete on public.request_votes
  for each row execute function public.request_votes_count();

-- Moves a conversation to the top of the list when a message arrives.
create or replace function public.messages_touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end $$;
comment on function public.messages_touch_conversation is 'Sorts chats by their latest message.';

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

create trigger requests_touch before update on public.requests for each row execute function public.touch_updated_at();
create trigger request_replies_touch before update on public.request_replies for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Ratings -> Plume (row lock so two ratings at once can't race)
-- ---------------------------------------------------------------------
create or replace function public.ratings_apply_plume() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ratee public.profiles;
  rater_plume numeric := 0;
  repeat_count int;
  d numeric;
begin
  -- 1. Lock the person being rated so concurrent ratings apply one after another.
  select * into ratee from public.profiles where id = new.ratee_id for update;
  if new.rater_id is not null then
    select plume into rater_plume from public.profiles where id = new.rater_id;
  end if;

  if tg_op = 'UPDATE' then
    -- 2a. Editing a rating: undo the old change first, keep the same deal count.
    ratee.plume := ratee.plume - coalesce(old.delta, 0);
    d := public.plume_delta(greatest(ratee.rated_deals - 1, 0), new.score, coalesce(rater_plume, 0));
  else
    -- 2b. Anti-gaming: repeat ratings between the same pair within 30 days count half.
    select count(*) into repeat_count from public.ratings r
    where r.rater_id = new.rater_id and r.ratee_id = new.ratee_id and r.created_at > now() - interval '30 days';
    d := public.plume_delta(ratee.rated_deals, new.score, coalesce(rater_plume, 0));
    if repeat_count > 0 then
      d := round(d / 2, 1);
    end if;
  end if;

  -- 3. Save before/after on the rating and update the profile.
  new.plume_before := ratee.plume;
  new.delta := d;
  new.plume_after := ratee.plume + d;
  update public.profiles
     set plume = new.plume_after,
         rated_deals = case when tg_op = 'INSERT' then rated_deals + 1 else rated_deals end
   where id = new.ratee_id;
  return new;
end $$;
comment on function public.ratings_apply_plume is 'Turns a rating into a Plume change using the K(n) and rater-weight formula.';

create trigger ratings_apply_plume
  before insert or update of score on public.ratings
  for each row execute function public.ratings_apply_plume();

-- =====================================================================
-- RPCs called by Server Actions (service role only)
-- =====================================================================

-- Fixed-window rate limiter. Returns true if this hit is allowed.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;
comment on function public.hit_rate_limit is 'Counts one hit for a key in the current window; false once over the limit.';

-- Counts a view on the item page.
create or replace function public.increment_listing_views(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ibay.system', 'on', true);
  update public.listings set views = views + 1 where id = p_listing;
end $$;
comment on function public.increment_listing_views is 'Adds one to a listing''s view counter.';

-- Places a bid with a row lock, minimum step and 2 minute anti-sniping.
create or replace function public.place_bid(p_listing uuid, p_bidder uuid, p_amount int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  top_bid public.bids;
  min_next int;
  new_end timestamptz;
begin
  -- 1. Lock the listing so two bids can't both think they are highest.
  select * into l from public.listings where id = p_listing for update;
  if not found or l.deleted_at is not null then
    raise exception 'IBAY: This auction no longer exists.' using errcode = 'P0001';
  end if;
  if l.mode <> 'auction' or l.status <> 'active' or l.ends_at <= now() then
    raise exception 'IBAY: This auction has ended.' using errcode = 'P0001';
  end if;
  if l.seller_id = p_bidder then
    raise exception 'IBAY: You can''t bid on your own auction.' using errcode = 'P0001';
  end if;

  -- 2. Work out the minimum next bid.
  select * into top_bid from public.bids where listing_id = p_listing order by amount desc, created_at asc limit 1;
  min_next := case when top_bid.id is null then l.reserve_price else top_bid.amount + public.bid_increment(top_bid.amount) end;
  if p_amount < min_next then
    raise exception 'IBAY: Bid at least Rs %.', min_next using errcode = 'P0001';
  end if;

  -- 3. Save the bid and move the shown price. Anti-sniping: a late bid pushes the end to 2 minutes from now.
  insert into public.bids (listing_id, bidder_id, amount) values (p_listing, p_bidder, p_amount);
  new_end := case when l.ends_at - now() < interval '2 minutes' then now() + interval '2 minutes' else l.ends_at end;
  perform set_config('ibay.system', 'on', true);
  update public.listings set price = p_amount, ends_at = new_end where id = p_listing;
  perform set_config('ibay.system', '', true);

  -- 4. Tell the person who was outbid and the seller.
  if top_bid.id is not null and top_bid.bidder_id <> p_bidder then
    insert into public.notifications (user_id, kind, icon, body, link)
    values (top_bid.bidder_id, 'outbid', 'hammer',
            'You were outbid on ' || l.title || '. Now Rs ' || to_char(p_amount, 'FM99,99,999') || '.', '/item/' || l.id);
  end if;
  insert into public.notifications (user_id, kind, icon, body, link)
  values (l.seller_id, 'bid', 'hammer', 'New bid of Rs ' || to_char(p_amount, 'FM99,99,999') || ' on ' || l.title || '.', '/item/' || l.id);

  return jsonb_build_object('amount', p_amount, 'ends_at', new_end, 'extended', new_end <> l.ends_at,
                            'outbid_user', case when top_bid.bidder_id <> p_bidder then top_bid.bidder_id end);
end $$;
comment on function public.place_bid is 'Atomic bid: locks the row, checks the minimum step, extends the end by 2 minutes for late bids.';

-- Buy it now on an auction: ends it at the buy-now price and creates the deal.
create or replace function public.auction_buy_now(p_listing uuid, p_buyer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  tx uuid;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.mode <> 'auction' or l.status <> 'active' or l.ends_at <= now() then
    raise exception 'IBAY: This auction has ended.' using errcode = 'P0001';
  end if;
  if l.buy_now_price is null then
    raise exception 'IBAY: This auction has no buy-now price.' using errcode = 'P0001';
  end if;
  if l.seller_id = p_buyer then
    raise exception 'IBAY: You can''t buy your own listing.' using errcode = 'P0001';
  end if;
  perform set_config('ibay.system', 'on', true);
  update public.listings set status = 'sold', price = l.buy_now_price, ends_at = now() where id = p_listing;
  perform set_config('ibay.system', '', true);
  insert into public.transactions (listing_id, buyer_id, seller_id, kind, amount)
  values (p_listing, p_buyer, l.seller_id, 'auction', l.buy_now_price) returning id into tx;
  insert into public.notifications (user_id, kind, icon, body, link)
  values (l.seller_id, 'sold', 'zap', 'Someone used Buy it now on ' || l.title || '.', '/deals');
  return tx;
end $$;
comment on function public.auction_buy_now is 'Ends an auction at the buy-now price for one buyer.';

-- Seller ends an auction: sell to any bidder (p_bid) or end without selling (p_bid null).
create or replace function public.close_auction(p_listing uuid, p_actor uuid, p_bid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  b public.bids;
  tx uuid;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id <> p_actor then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.mode <> 'auction' or l.status not in ('active', 'closed') then
    raise exception 'IBAY: This auction is already finished.' using errcode = 'P0001';
  end if;
  perform set_config('ibay.system', 'on', true);
  if p_bid is null then
    update public.listings set status = 'expired', ends_at = least(ends_at, now()) where id = p_listing;
    perform set_config('ibay.system', '', true);
    return null;
  end if;
  select * into b from public.bids where id = p_bid and listing_id = p_listing;
  if not found then
    raise exception 'IBAY: That bid is not on this auction.' using errcode = 'P0001';
  end if;
  update public.listings set status = 'sold', price = b.amount, ends_at = least(ends_at, now()) where id = p_listing;
  perform set_config('ibay.system', '', true);
  insert into public.transactions (listing_id, buyer_id, seller_id, kind, amount)
  values (p_listing, b.bidder_id, p_actor, 'auction', b.amount) returning id into tx;
  insert into public.notifications (user_id, kind, icon, body, link)
  values (b.bidder_id, 'won', 'trophy', 'You won ' || l.title || ' at Rs ' || to_char(b.amount, 'FM99,99,999') || '. Arrange pickup in chat.', '/deals');
  return tx;
end $$;
comment on function public.close_auction is 'Seller picks any bidder (not only the highest) or ends without selling.';

-- Claim a food drop: first come, first served, and only from the same hostel.
create or replace function public.claim_drop(p_listing uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  me public.profiles;
  tx uuid;
begin
  select * into me from public.profiles where id = p_user;
  -- WHY: the WHERE clause makes the claim atomic; a second claimer updates zero rows.
  perform set_config('ibay.system', 'on', true);
  update public.listings
     set status = 'claimed'
   where id = p_listing and mode = 'drop' and status = 'active' and ends_at > now()
     and pickup_hostel = me.hostel and seller_id <> p_user and deleted_at is null
  returning * into l;
  perform set_config('ibay.system', '', true);
  -- WHY: check the returned row (PERFORM resets FOUND).
  if l.id is null then
    raise exception 'IBAY: Someone else claimed it first, or it has expired.' using errcode = 'P0001';
  end if;
  insert into public.transactions (listing_id, buyer_id, seller_id, kind, amount)
  values (p_listing, p_user, l.seller_id, 'sale', l.price) returning id into tx;
  insert into public.notifications (user_id, kind, icon, body, link)
  values (l.seller_id, 'claimed', 'flame', me.name || ' claimed your drop: ' || l.title || '.', '/deals');
  return tx;
end $$;
comment on function public.claim_drop is 'Atomic food-drop claim limited to the seller''s hostel.';

-- Book a rental. Overlaps are refused by the exclusion constraint on rental_bookings.
create or replace function public.book_rental(p_listing uuid, p_renter uuid, p_start timestamptz, p_end timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  hours numeric;
  units int;
  amt int;
  tx uuid;
  bk uuid;
begin
  select * into l from public.listings where id = p_listing;
  if not found or l.mode <> 'rent' or l.status <> 'active' or l.deleted_at is not null then
    raise exception 'IBAY: This item is not available to rent right now.' using errcode = 'P0001';
  end if;
  if l.seller_id = p_renter then
    raise exception 'IBAY: You can''t rent your own item.' using errcode = 'P0001';
  end if;
  if p_end <= p_start or p_start < now() - interval '1 hour' then
    raise exception 'IBAY: Pick a time in the future.' using errcode = 'P0001';
  end if;

  -- 1. Work out how many units are charged (hours, days, weeks or months, rounded up).
  hours := extract(epoch from (p_end - p_start)) / 3600;
  units := case l.rent_unit
             when 'hour' then ceil(hours)
             when 'day' then ceil(hours / 24)
             when 'week' then ceil(hours / 24 / 7)
             else ceil(hours / 24 / 30) end;
  amt := greatest(units, 1) * l.price;

  -- 2. Create the deal, then the booking (the booking insert fails if it overlaps).
  insert into public.transactions (listing_id, buyer_id, seller_id, kind, amount, deposit, days)
  values (p_listing, p_renter, l.seller_id, 'rental', amt, coalesce(l.deposit, 0), greatest(1, ceil(hours / 24)::int))
  returning id into tx;
  begin
    insert into public.rental_bookings (listing_id, renter_id, transaction_id, period)
    values (p_listing, p_renter, tx, tstzrange(p_start, p_end, '[)')) returning id into bk;
  exception when exclusion_violation then
    raise exception 'IBAY: Some of that time was just booked by someone else. Pick another slot.' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, kind, icon, body, link)
  select l.seller_id, 'booking', 'cal', p.name || ' booked ' || l.title || '.', '/deals' from public.profiles p where p.id = p_renter;
  return jsonb_build_object('transaction_id', tx, 'booking_id', bk, 'amount', amt, 'units', greatest(units, 1));
end $$;
comment on function public.book_rental is 'Creates a rental deal and booking; overlapping bookings raise a friendly error.';

-- Soft delete with guard rails. Only the owner (or an admin) can do it.
create or replace function public.soft_delete_listing(p_listing uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  is_admin boolean;
begin
  select (role = 'admin') into is_admin from public.profiles where id = p_actor;
  select * into l from public.listings where id = p_listing for update;
  -- WHY: "not found" for someone else's listing, so ids can't be probed.
  if not found or (l.seller_id <> p_actor and not coalesce(is_admin, false)) then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.status = 'deleted' then
    return;
  end if;
  if l.mode = 'auction' and l.status = 'active' and exists (select 1 from public.bids where listing_id = p_listing) then
    raise exception 'IBAY_GUARD_AUCTION: People have bid on this auction. End the auction instead.' using errcode = 'P0001';
  end if;
  if l.mode = 'rent' and exists (
       select 1 from public.rental_bookings rb
       where rb.listing_id = p_listing and rb.status = 'confirmed' and upper(rb.period) > now()) then
    raise exception 'IBAY_GUARD_RENTAL: Someone has an active or upcoming booking. Pause it instead.' using errcode = 'P0001';
  end if;
  perform set_config('ibay.system', 'on', true);
  update public.listings
     set status_before_delete = status, status = 'deleted', deleted_at = now()
   where id = p_listing;
  perform set_config('ibay.system', '', true);
  -- Saved lists drop it straight away.
  delete from public.saved_items where listing_id = p_listing;
  insert into public.audit_log (actor_id, entity, entity_id, action, before, after)
  values (p_actor, 'listing', p_listing, 'delete', jsonb_build_object('status', l.status), jsonb_build_object('status', 'deleted'));
end $$;
comment on function public.soft_delete_listing is 'Soft delete: hides the listing everywhere, keeps chats, restorable for 30 days.';

-- Restore a soft-deleted listing (Undo toast or the Deleted tab).
create or replace function public.restore_listing(p_listing uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id <> p_actor then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.status <> 'deleted' then
    return;
  end if;
  perform set_config('ibay.system', 'on', true);
  update public.listings
     set status = coalesce(nullif(status_before_delete, 'deleted'), 'active'), deleted_at = null, status_before_delete = null
   where id = p_listing;
  perform set_config('ibay.system', '', true);
  insert into public.audit_log (actor_id, entity, entity_id, action, before, after)
  values (p_actor, 'listing', p_listing, 'restore', jsonb_build_object('status', 'deleted'), jsonb_build_object('status', coalesce(l.status_before_delete, 'active')));
end $$;
comment on function public.restore_listing is 'Brings a soft-deleted listing back with its previous status.';

-- Mark as sold, optionally to a chat partner. Other chats about it get an automatic note.
create or replace function public.mark_sold(p_listing uuid, p_actor uuid, p_buyer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  tx uuid;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id <> p_actor or l.deleted_at is not null then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.status not in ('active', 'paused') then
    raise exception 'IBAY: This listing is already finished.' using errcode = 'P0001';
  end if;
  perform set_config('ibay.system', 'on', true);
  update public.listings set status = 'sold' where id = p_listing;
  perform set_config('ibay.system', '', true);
  if p_buyer is not null then
    insert into public.transactions (listing_id, buyer_id, seller_id, kind, amount, stage)
    values (p_listing, p_buyer, p_actor, case when l.mode = 'rent' then 'rental'::deal_kind else 'sale'::deal_kind end, l.price, 1)
    returning id into tx;
  end if;
  -- WHY: buyers who were still asking should hear it is gone, without the seller replying to each.
  insert into public.messages (conversation_id, sender_id, kind, body, listing_id)
  select c.id, null, 'system', 'This item has been sold. Thanks for your interest.', p_listing
  from public.conversations c
  where c.listing_id = p_listing and p_actor in (c.user_a, c.user_b)
    and (p_buyer is null or p_buyer not in (c.user_a, c.user_b));
  return tx;
end $$;
comment on function public.mark_sold is 'Marks a listing sold, creates the deal and auto-replies to other chats.';

-- Moves a deal one step forward after a handover check.
create or replace function public.advance_deal(p_tx uuid, p_actor uuid, p_photos boolean, p_money boolean) returns smallint
language plpgsql security definer set search_path = public as $$
declare
  t public.transactions;
  last_stage int;
  step_name text;
begin
  select * into t from public.transactions where id = p_tx for update;
  if not found or p_actor not in (t.buyer_id, t.seller_id) then
    raise exception 'IBAY: Deal not found.' using errcode = 'P0002';
  end if;
  last_stage := case when t.kind = 'rental' then 3 else 2 end;
  if t.stage >= last_stage - 1 then
    raise exception 'IBAY: This deal is ready to rate.' using errcode = 'P0001';
  end if;
  step_name := case when t.kind = 'rental' then (array['Picked up','Returned'])[t.stage + 1] else 'Handed over' end;
  insert into public.handover_checks (transaction_id, by_user, step, photos_taken, money_done)
  values (p_tx, p_actor, step_name, p_photos, p_money);
  update public.transactions set stage = stage + 1 where id = p_tx;
  if step_name = 'Returned' then
    update public.rental_bookings set status = 'completed' where transaction_id = p_tx;
  end if;
  return t.stage + 1;
end $$;
comment on function public.advance_deal is 'Records a handover check and advances the deal tracker.';

-- Submit (or edit within 24 h) a rating. Only the two people in a finished deal can rate.
create or replace function public.submit_rating(p_tx uuid, p_rater uuid, p_score int, p_reason text, p_tags text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.transactions;
  last_stage int;
  other uuid;
  existing public.ratings;
  r public.ratings;
begin
  select * into t from public.transactions where id = p_tx;
  if not found or p_rater not in (t.buyer_id, t.seller_id) then
    raise exception 'IBAY: Deal not found.' using errcode = 'P0002';
  end if;
  last_stage := case when t.kind = 'rental' then 3 else 2 end;
  if t.stage < last_stage - 1 then
    raise exception 'IBAY: You can rate once the handover is done.' using errcode = 'P0001';
  end if;
  other := case when p_rater = t.buyer_id then t.seller_id else t.buyer_id end;

  select * into existing from public.ratings where transaction_id = p_tx and rater_id = p_rater;
  if found then
    if existing.editable_until < now() then
      raise exception 'IBAY: Ratings can only be edited within 24 hours.' using errcode = 'P0001';
    end if;
    update public.ratings set score = p_score, reason = p_reason, tags = coalesce(p_tags, '{}')
     where id = existing.id returning * into r;
  else
    insert into public.ratings (transaction_id, rater_id, ratee_id, score, reason, tags)
    values (p_tx, p_rater, other, p_score, p_reason, coalesce(p_tags, '{}')) returning * into r;
    insert into public.notifications (user_id, kind, icon, body, link)
    select other, 'rating', 'star', p.name || ' rated you ' || case when p_score > 0 then '+' else '' end || p_score || '. Feather ' ||
           case when r.delta >= 0 then '+' else '' end || r.delta || '.', '/you'
    from public.profiles p where p.id = p_rater;
  end if;
  return jsonb_build_object('id', r.id, 'delta', r.delta, 'plume_before', r.plume_before, 'plume_after', r.plume_after);
end $$;
comment on function public.submit_rating is 'Creates or edits a rating; the ratings trigger updates Plume.';

-- Toggle an upvote on a request. Returns true when the user now votes for it.
create or replace function public.toggle_request_vote(p_request uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.request_votes where request_id = p_request and user_id = p_user;
  if found then
    return false;
  end if;
  insert into public.request_votes (request_id, user_id) values (p_request, p_user);
  return true;
end $$;
comment on function public.toggle_request_vote is 'Adds or removes one "need this" vote.';

-- Cron: end auctions and food drops whose timers ran out.
create or replace function public.expire_listings() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform set_config('ibay.system', 'on', true);
  -- Auctions with bids wait for the seller to pick a buyer ("closed"); no bids means "expired".
  update public.listings l
     set status = case when exists (select 1 from public.bids b where b.listing_id = l.id) then 'closed'::listing_status else 'expired'::listing_status end
   where l.mode in ('auction', 'drop') and l.status = 'active' and l.ends_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
comment on function public.expire_listings is 'Runs every minute: ends auctions and food drops that are past their end time.';

-- Images whose listings were purged; a server task deletes them from Cloudinary.
create table public.media_trash (
  public_id text primary key,
  created_at timestamptz not null default now()
);
comment on table public.media_trash is 'Cloudinary files waiting to be deleted after a hard delete.';

-- Cron: hard-delete listings soft-deleted more than 30 days ago.
create or replace function public.purge_deleted_listings() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into public.media_trash (public_id)
  select i.public_id from public.listing_images i
  join public.listings l on l.id = i.listing_id
  where l.status = 'deleted' and l.deleted_at < now() - interval '30 days' and i.public_id is not null
  on conflict do nothing;
  delete from public.listings where status = 'deleted' and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from public.requests where status = 'deleted' and deleted_at < now() - interval '30 days';
  delete from public.rate_limits where window_start < now() - interval '2 days';
  delete from public.email_otps where created_at < now() - interval '2 days';
  return n;
end $$;
comment on function public.purge_deleted_listings is 'Runs daily: removes soft-deleted rows older than 30 days and old security rows.';

-- Only the server (service role) may call the RPCs that change data.
-- (Small helpers such as plume_k stay callable because triggers use them.)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('hit_rate_limit','increment_listing_views','place_bid','auction_buy_now','close_auction','claim_drop',
                        'book_rental','soft_delete_listing','restore_listing','mark_sold','advance_deal','submit_rating',
                        'toggle_request_vote','expire_listings','purge_deleted_listings')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
