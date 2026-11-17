-- =====================================================================
-- i-bay schema, part 4: scheduled jobs (pg_cron).
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;

-- Every minute: end auctions and food drops whose timers ran out.
select cron.schedule('ibay-expire-listings', '* * * * *', $$select public.expire_listings()$$);

-- Every day at 03:00 UTC: hard-delete listings soft-deleted more than 30 days ago.
select cron.schedule('ibay-purge-deleted', '0 3 * * *', $$select public.purge_deleted_listings()$$);
