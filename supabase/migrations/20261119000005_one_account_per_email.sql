-- One account per email, whatever the capitalisation.
-- The app already lowercases emails; these rules make the database enforce it too.

-- Emails are stored in lowercase with no spaces around them.
alter table public.profiles drop constraint if exists profiles_email_lowercase;
alter table public.profiles
  add constraint profiles_email_lowercase check (email = lower(btrim(email)));

-- "A@iimidr.ac.in" and "a@iimidr.ac.in" count as the same account.
create unique index if not exists profiles_email_lower_key on public.profiles (lower(email));

comment on index public.profiles_email_lower_key is 'One account per email (case-insensitive).';
