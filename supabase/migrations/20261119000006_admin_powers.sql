-- Admin powers: edit, delete and restore any listing; delete a person's account.
-- Owners keep exactly the same rules as before. Only role = 'admin' (and not banned) gets more.

-- 1. Who is an admin (by id; the existing is_admin() checks the signed-in user instead).
create or replace function public.is_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and not banned from public.profiles where id = p_user), false)
$$;
comment on function public.is_admin_user(uuid) is 'True for an active (not banned) admin account.';

-- 2. Let admins edit and restore any listing, and delete one even with bids or bookings.
-- WHY patch the live definitions: some functions were updated by hand in the SQL editor,
-- so rewriting them from older files could undo those changes. Each patch fails loudly
-- if the text it expects is missing, instead of silently doing nothing.
do $$
declare
  d text;
begin
  -- Edit any listing (all other rules: locks, deleted, conflicts, stay the same).
  d := pg_get_functiondef('public.update_listing(uuid,uuid,timestamptz,jsonb)'::regprocedure);
  if position('or l.seller_id <> p_actor then' in d) = 0 then raise exception 'update_listing: owner check not found'; end if;
  execute replace(d, 'or l.seller_id <> p_actor then', 'or (l.seller_id <> p_actor and not public.is_admin_user(p_actor)) then');

  -- Restore any deleted listing.
  d := pg_get_functiondef('public.restore_listing(uuid,uuid)'::regprocedure);
  if position('or l.seller_id <> p_actor then' in d) = 0 then raise exception 'restore_listing: owner check not found'; end if;
  execute replace(d, 'or l.seller_id <> p_actor then', 'or (l.seller_id <> p_actor and not public.is_admin_user(p_actor)) then');

  -- Delete (soft) any listing: the "has bids" and "has bookings" guards protect owners, not admins.
  d := pg_get_functiondef('public.soft_delete_listing(uuid,uuid)'::regprocedure);
  if position('if l.mode = ''auction'' and l.status = ''active'' and exists' in d) = 0
     or position('if l.mode = ''rent'' and exists (' in d) = 0 then
    raise exception 'soft_delete_listing: guards not found';
  end if;
  d := replace(d, 'if l.mode = ''auction'' and l.status = ''active'' and exists', 'if not coalesce(is_admin, false) and l.mode = ''auction'' and l.status = ''active'' and exists');
  d := replace(d, 'if l.mode = ''rent'' and exists (', 'if not coalesce(is_admin, false) and l.mode = ''rent'' and exists (');
  execute d;
end $$;

-- 3. Delete a person's account and everything that belongs to it.
-- Their listings, bids, deals, chats and saved items go with them (ON DELETE CASCADE).
-- Auctions they bid on fall back to the next highest bid (or the starting price).
create or replace function public.admin_delete_user(p_user uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  target public.profiles;
  auctions uuid[];
  n_listings int;
begin
  if not public.is_admin_user(p_actor) then
    raise exception 'IBAY: Admins only.' using errcode = 'P0001';
  end if;
  select * into target from public.profiles where id = p_user for update;
  if not found then
    raise exception 'IBAY: That account no longer exists.' using errcode = 'P0002';
  end if;
  if p_user = p_actor or target.role = 'admin' then
    raise exception 'IBAY: Admin accounts can''t be deleted here.' using errcode = 'P0001';
  end if;

  select array_agg(distinct b.listing_id) into auctions
    from public.bids b join public.listings l on l.id = b.listing_id
   where b.bidder_id = p_user and l.seller_id <> p_user;
  select count(*) into n_listings from public.listings where seller_id = p_user;

  insert into public.audit_log (actor_id, entity, entity_id, action, before, after)
  values (p_actor, 'profile', p_user, 'delete',
          jsonb_build_object('name', target.name, 'email', target.email, 'listings', n_listings),
          jsonb_build_object('by', 'admin'));

  perform set_config('ibay.system', 'on', true);
  delete from public.email_otps where email = target.email;
  delete from public.profiles where id = p_user;
  if auctions is not null then
    update public.listings l
       set price = coalesce((select max(amount) from public.bids where listing_id = l.id), l.reserve_price, l.price)
     where l.id = any (auctions) and l.mode = 'auction';
  end if;
  perform set_config('ibay.system', '', true);

  return jsonb_build_object('listings', n_listings);
end $$;
comment on function public.admin_delete_user(uuid, uuid) is 'Admin only: deletes an account and its data; fixes prices on auctions it bid on.';

-- Only the server (service role) may call these.
revoke all on function public.is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_admin_user(uuid) to service_role;
grant execute on function public.admin_delete_user(uuid, uuid) to service_role;
