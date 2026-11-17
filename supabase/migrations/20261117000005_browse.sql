-- =====================================================================
-- i-bay schema, part 5: browse and search. [RUBRIC:DATA-DISPLAY]
-- One function does search, every filter, every sort and pagination, so the
-- browse page, home rails and Mayu all agree on what is visible.
-- =====================================================================

-- Turns "yonex racquets" into the prefix query  yonex:* & racquet:*
create or replace function public.prefix_tsquery(q text) returns tsquery
language sql immutable as $$
  select to_tsquery('simple', coalesce(string_agg(regexp_replace(w, 's$', '') || ':*', ' & '), ''))
  from regexp_split_to_table(lower(coalesce(q, '')), '[^a-z0-9]+') as w
  where length(w) > 0
$$;
comment on function public.prefix_tsquery is 'Builds a prefix full-text query, ignoring plural s.';

-- Returns the ids (and the total count) of listings matching the browse filters.
create or replace function public.browse_listing_ids(
  p_q text default null,
  p_category text default null,
  p_modes text[] default null,
  p_viewer uuid default null,
  p_near boolean default false,
  p_trusted boolean default false,
  p_age_months int default null,
  p_min int default null,
  p_max int default null,
  p_size text default null,
  p_available date default null,
  p_collection text default null,
  p_sort text default 'best',
  p_limit int default 24,
  p_offset int default 0
) returns table (id uuid, total bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_hostel text;
  v_rule jsonb;
  v_tsq tsquery;
  v_day_start timestamptz;
begin
  -- 1. Who is looking (food drops are only visible inside the viewer's hostel).
  select hostel into v_hostel from public.profiles where profiles.id = p_viewer;
  select rule into v_rule from public.collections where collections.id = p_collection;
  v_tsq := case when coalesce(trim(p_q), '') = '' then null else public.prefix_tsquery(p_q) end;
  v_day_start := case when p_available is null then null else (p_available::timestamp at time zone 'Asia/Kolkata') end;

  return query
  with base as (
    select l.*, s.plume as seller_plume, s.hostel as seller_hostel,
           case when v_tsq is null then 0
                else ts_rank(l.search, v_tsq) + word_similarity(lower(p_q), lower(l.title)) end as rank
    from public.listings l
    join public.profiles s on s.id = l.seller_id and not s.banned and s.deleted_at is null
    where l.status = 'active' and l.deleted_at is null
      and (p_viewer is null or l.seller_id <> p_viewer)
      and (l.mode not in ('auction', 'drop') or l.ends_at > now())
      -- WHY: hostel-only food drops, same rule as the RLS policy.
      and (l.mode <> 'drop' or (v_hostel is not null and l.pickup_hostel = v_hostel))
      and (p_category is null or p_category = 'all' or l.category_id = p_category)
      and (p_modes is null or cardinality(p_modes) = 0 or l.mode::text = any (p_modes))
      and (v_tsq is null or l.search @@ v_tsq or word_similarity(lower(p_q), lower(l.title)) > 0.45)
      and (not p_near or l.pickup_hostel = v_hostel)
      and (not p_trusted or s.plume >= 60)
      and (p_age_months is null or l.purchased_on is null or l.purchased_on > (current_date - make_interval(months => p_age_months)))
      and (p_min is null or l.price >= p_min)
      and (p_max is null or l.price <= p_max)
      and (p_size is null or l.size = p_size)
      and (v_rule is null
           or (v_rule ? 'tags_any' and l.tags && array(select jsonb_array_elements_text(v_rule->'tags_any')))
           or (v_rule ? 'categories' and l.category_id = any (array(select jsonb_array_elements_text(v_rule->'categories')))
               and not (l.tags && array(select jsonb_array_elements_text(coalesce(v_rule->'exclude_tags', '[]'::jsonb))))))
      and (p_available is null or l.mode in ('sell', 'auction') or (
            l.mode = 'rent' and not exists (
              select 1 from public.rental_bookings b
              where b.listing_id = l.id and b.status = 'confirmed'
                and case when l.rent_unit = 'hour'
                         then b.period @> tstzrange(v_day_start, v_day_start + interval '1 day')
                         else b.period && tstzrange(v_day_start, v_day_start + interval '1 day') end)))
  )
  select b.id, count(*) over () as total
  from base b
  order by
    case when p_sort = 'low' then b.price end asc,
    case when p_sort = 'high' then b.price end desc,
    case when p_sort = 'off' then case when b.mrp > 0 and b.mode = 'sell' then 1 - b.price::numeric / b.mrp else -1 end end desc,
    case when p_sort = 'new' then b.created_at end desc,
    case when p_sort = 'young' then b.purchased_on end desc nulls last,
    case when p_sort = 'trust' then b.seller_plume end desc,
    case when p_sort = 'best' then (b.pickup_hostel = v_hostel)::int end desc,
    case when p_sort = 'best' then b.rank end desc,
    case when p_sort = 'best' then b.seller_plume end desc,
    b.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
end $$;
comment on function public.browse_listing_ids is 'Search (full-text + trigram typos), filters, sorts and pagination for browse, rails and Mayu.';

revoke execute on function public.browse_listing_ids(text, text, text[], uuid, boolean, boolean, int, int, int, text, date, text, text, int, int) from public, anon, authenticated;
grant execute on function public.browse_listing_ids(text, text, text[], uuid, boolean, boolean, int, int, int, text, date, text, text, int, int) to service_role;
