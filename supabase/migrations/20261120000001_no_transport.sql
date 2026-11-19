-- IIM Indore doesn't allow cycles or any other personal transport on campus.
-- 1. "Cycles & Travel" becomes "Travel & Outdoors" (tents, trekking backpacks, duffels).
update public.categories
   set name = 'Travel & Outdoors',
       short_name = 'Travel',
       description = 'Tents, trekking backpacks, duffels and trip gear',
       icon = 'pkg',
       cover_url = '/img/tent.webp'
 where id = 'travel';

-- 2. Remove the cycle and two-wheeler helmet listings (neither had deals, bids or bookings).
delete from public.listings
 where title in ('Hercules Roadeo A50 city cycle with lock', 'Steelbird SBH-17 helmet, size M');
