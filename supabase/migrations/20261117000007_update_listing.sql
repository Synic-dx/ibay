-- =====================================================================
-- i-bay schema, part 7: editing listings (the "U" in CRUD). [RUBRIC:CRUD-UPDATE]
-- =====================================================================

-- Edits a listing in one transaction:
--   1. only the owner, and not a deleted listing
--   2. optimistic concurrency: refuses if updated_at changed since the form was opened
--   3. records who changed it (for listing_price_history) and an audit_log diff
--   4. the listings_before_write trigger still enforces the mode locks
create or replace function public.update_listing(p_listing uuid, p_actor uuid, p_expected timestamptz, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  n public.listings;
  b jsonb;
  a jsonb;
  k text;
  diff_before jsonb := '{}'::jsonb;
  diff_after jsonb := '{}'::jsonb;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id <> p_actor then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.deleted_at is not null then
    raise exception 'IBAY: This listing was deleted. Restore it first.' using errcode = 'P0001';
  end if;
  if p_expected is not null and l.updated_at <> p_expected then
    raise exception 'IBAY_CONFLICT: This listing changed since you opened it. Reload to see the latest.' using errcode = 'P0001';
  end if;
  if p_patch ? 'status' and ((p_patch->>'status') not in ('active', 'paused') or l.status not in ('active', 'paused')) then
    raise exception 'IBAY: You can only pause or resume a listing here.' using errcode = 'P0001';
  end if;

  perform set_config('ibay.actor', p_actor::text, true);
  update public.listings set
    title          = case when p_patch ? 'title' then p_patch->>'title' else title end,
    description    = case when p_patch ? 'description' then p_patch->>'description' else description end,
    category_id    = case when p_patch ? 'category_id' then p_patch->>'category_id' else category_id end,
    condition      = case when p_patch ? 'condition' then (p_patch->>'condition')::item_condition else condition end,
    price          = case when p_patch ? 'price' then (p_patch->>'price')::int else price end,
    mrp            = case when p_patch ? 'mrp' then (p_patch->>'mrp')::int else mrp end,
    rent_unit      = case when p_patch ? 'rent_unit' then (p_patch->>'rent_unit')::rent_unit else rent_unit end,
    deposit        = case when p_patch ? 'deposit' then (p_patch->>'deposit')::int else deposit end,
    reserve_price  = case when p_patch ? 'reserve_price' then (p_patch->>'reserve_price')::int else reserve_price end,
    buy_now_price  = case when p_patch ? 'buy_now_price' then (p_patch->>'buy_now_price')::int else buy_now_price end,
    ends_at        = case when p_patch ? 'ends_at' then (p_patch->>'ends_at')::timestamptz else ends_at end,
    status         = case when p_patch ? 'status' then (p_patch->>'status')::listing_status else status end,
    brand          = case when p_patch ? 'brand' then p_patch->>'brand' else brand end,
    model          = case when p_patch ? 'model' then p_patch->>'model' else model end,
    size           = case when p_patch ? 'size' then p_patch->>'size' else size end,
    specs          = case when p_patch ? 'specs' then p_patch->'specs' else specs end,
    purchased_on   = case when p_patch ? 'purchased_on' then (p_patch->>'purchased_on')::date else purchased_on end,
    seal_status    = case when p_patch ? 'seal_status' then p_patch->>'seal_status' else seal_status end,
    expires_on     = case when p_patch ? 'expires_on' then (p_patch->>'expires_on')::date else expires_on end,
    is_bundle      = case when p_patch ? 'is_bundle' then (p_patch->>'is_bundle')::boolean else is_bundle end,
    bundle_contents = case when p_patch ? 'bundle_contents' then array(select jsonb_array_elements_text(p_patch->'bundle_contents')) else bundle_contents end,
    tags           = case when p_patch ? 'tags' then array(select jsonb_array_elements_text(p_patch->'tags')) else tags end
  where id = p_listing
  returning * into n;

  -- Photos are replaced as a set (new order, removed and added photos).
  if p_patch ? 'photos' then
    delete from public.listing_images where listing_id = p_listing;
    insert into public.listing_images (listing_id, url, public_id, fit, position)
    select p_listing, e->>'url', nullif(e->>'publicId', ''), coalesce(e->>'fit', 'cover'), (ord - 1)::smallint
    from jsonb_array_elements(p_patch->'photos') with ordinality as t(e, ord)
    where ord <= 6;
  end if;

  -- Audit log: only the fields that actually changed.
  b := to_jsonb(l) - 'search' - 'updated_at' - 'views' - 'saves';
  a := to_jsonb(n) - 'search' - 'updated_at' - 'views' - 'saves';
  for k in select jsonb_object_keys(a) loop
    if (b->k) is distinct from (a->k) then
      diff_before := diff_before || jsonb_build_object(k, b->k);
      diff_after := diff_after || jsonb_build_object(k, a->k);
    end if;
  end loop;
  if p_patch ? 'photos' then
    diff_after := diff_after || jsonb_build_object('photos', jsonb_array_length(p_patch->'photos'));
  end if;
  if diff_after <> '{}'::jsonb then
    insert into public.audit_log (actor_id, entity, entity_id, action, before, after)
    values (p_actor, 'listing', p_listing, 'update', diff_before, diff_after);
  end if;

  return jsonb_build_object('updated_at', n.updated_at, 'changed', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_object_keys(diff_after) x),
                            'price_drop', case when n.price < l.price then l.price - n.price end);
end $$;
comment on function public.update_listing is 'Owner-only edit with optimistic concurrency, price history actor and audit diff.';

-- "Relist": copies a sold or ended listing into a new active one (the original stays read-only).
create or replace function public.relist_listing(p_listing uuid, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  new_id uuid;
begin
  select * into l from public.listings where id = p_listing;
  if not found or l.seller_id <> p_actor then
    raise exception 'IBAY: Listing not found.' using errcode = 'P0002';
  end if;
  if l.mode = 'drop' then
    raise exception 'IBAY: Food drops can''t be relisted. Post a new drop instead.' using errcode = 'P0001';
  end if;
  insert into public.listings (seller_id, category_id, mode, title, description, condition, price, mrp, rent_unit, deposit,
    reserve_price, buy_now_price, ends_at, brand, model, size, specs, purchased_on, seal_status, expires_on, is_bundle,
    bundle_contents, ticket_info, pickup_hostel, tags, relisted_from)
  values (l.seller_id, l.category_id, l.mode, l.title, l.description, l.condition,
    case when l.mode = 'auction' then l.reserve_price else l.price end, l.mrp, l.rent_unit, l.deposit,
    l.reserve_price, l.buy_now_price, case when l.mode = 'auction' then now() + interval '1 day' end,
    l.brand, l.model, l.size, l.specs, l.purchased_on, l.seal_status, l.expires_on, l.is_bundle,
    l.bundle_contents, l.ticket_info, (select hostel from public.profiles where id = p_actor), l.tags, l.id)
  returning id into new_id;
  insert into public.listing_images (listing_id, url, public_id, fit, position)
  select new_id, url, public_id, fit, position from public.listing_images where listing_id = p_listing;
  insert into public.audit_log (actor_id, entity, entity_id, action, before, after)
  values (p_actor, 'listing', new_id, 'create', null, jsonb_build_object('relisted_from', p_listing));
  return new_id;
end $$;
comment on function public.relist_listing is 'Copies a finished listing into a fresh active one.';

revoke execute on function public.update_listing(uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.update_listing(uuid, uuid, timestamptz, jsonb) to service_role;
revoke execute on function public.relist_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.relist_listing(uuid, uuid) to service_role;
