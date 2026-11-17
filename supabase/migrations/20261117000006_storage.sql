-- =====================================================================
-- i-bay schema, part 6: photo storage fallback.
-- Photos normally go to Cloudinary (signed uploads). If Cloudinary keys are
-- not set, the server uploads to this public bucket instead (jpg/png/webp,
-- max 5 MB). Only the server (service role) writes to it.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
