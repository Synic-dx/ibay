-- 1. "Preprocess Store" is now "Getups & Costumes": the same hourly rentals, used for
--    club and committee interviews, preprocesses, class presentations and theme nights.
--    The id stays 'preprocess' so links and existing listings keep working.
update public.categories
   set name = 'Getups & Costumes',
       short_name = 'Getups',
       description = 'Wigs, costumes and props for club and committee interviews, preprocesses, class presentations and theme nights. Rent by the hour.'
 where id = 'preprocess';

-- 2. IIM Indore has no day scholars: everyone lives on campus, so "Day scholar"
--    is no longer a valid residence (nobody had it when this ran).
alter table public.profiles drop constraint if exists profiles_hostel_check;
alter table public.profiles
  add constraint profiles_hostel_check check (hostel in (
    'SR 01', 'SR 02', 'SR 03', 'SR 04', 'SR 05', 'SR 06', 'SR 07', 'SR 08', 'SR 09', 'SR 10',
    'SR 11', 'SR 12', 'SR 13', 'SR 14', 'SR 15', 'SR 16A', 'SR 16B', 'SR 17', 'SR 18', 'SR 19', 'SR 20',
    'DPM Residence', 'EPGP Hostel',
    'Executive Residence 01', 'Executive Residence 02', 'Executive Residence 03', 'Executive Residence 04',
    'Married Residence 01'
  ));
