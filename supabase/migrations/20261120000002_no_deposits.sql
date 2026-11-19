-- i-bay doesn't take refundable deposits on rentals.
-- The deposit columns stay (database functions for booking and relisting still
-- reference them), but nothing asks for, stores or shows a deposit any more.

-- 1. Rentals no longer need a deposit: only a rate and a unit.
alter table public.listings drop constraint if exists listings_rent_fields;
alter table public.listings
  add constraint listings_rent_fields check (mode <> 'rent' or (rent_unit is not null and price >= 1));

-- 2. Clear existing amounts (already done on 20 Nov 2026 through the app's server key).
select set_config('ibay.system', 'on', true);
update public.listings set deposit = 0 where deposit > 0;
update public.transactions set deposit = 0 where deposit > 0;

comment on column public.listings.deposit is 'Unused: i-bay takes no deposits. Kept for older database functions; always 0 or null.';
comment on column public.transactions.deposit is 'Unused: i-bay takes no deposits. Always 0.';
