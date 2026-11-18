-- Migration: Campus Map Integration & Real Residence Roster
-- Description:
-- 1. Updates profiles.hostel constraint to the official 28 IIM Indore residences + Day scholar
-- 2. Migrates existing test profiles to SR 01 - SR 06
-- 3. Adds pickup_lat, pickup_lng, and pickup_note to listings
-- 4. Adds handover_lat, handover_lng, handover_spot_name, and handover_agreed_at to transactions

-- 1. Update profiles table constraint & default
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_hostel_check;

UPDATE public.profiles
SET hostel = CASE hostel
  WHEN 'Hostel 1' THEN 'SR 01'
  WHEN 'Hostel 2' THEN 'SR 02'
  WHEN 'Hostel 3' THEN 'SR 03'
  WHEN 'Hostel 4' THEN 'SR 04'
  WHEN 'Hostel 5' THEN 'SR 05'
  WHEN 'Hostel 6' THEN 'SR 06'
  ELSE COALESCE(hostel, 'SR 01')
END;

ALTER TABLE public.profiles
ALTER COLUMN hostel SET DEFAULT 'SR 01';

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_hostel_check CHECK (
  hostel IN (
    'SR 01', 'SR 02', 'SR 03', 'SR 04', 'SR 05', 'SR 06', 'SR 07', 'SR 08', 'SR 09', 'SR 10',
    'SR 11', 'SR 12', 'SR 13', 'SR 14', 'SR 15', 'SR 16A', 'SR 16B', 'SR 17', 'SR 18', 'SR 19', 'SR 20',
    'DPM Residence', 'EPGP Hostel',
    'Executive Residence 01', 'Executive Residence 02', 'Executive Residence 03', 'Executive Residence 04',
    'Married Residence 01', 'Day scholar'
  )
);

-- Update pickup_hostel in listings if needed
UPDATE public.listings
SET pickup_hostel = CASE pickup_hostel
  WHEN 'Hostel 1' THEN 'SR 01'
  WHEN 'Hostel 2' THEN 'SR 02'
  WHEN 'Hostel 3' THEN 'SR 03'
  WHEN 'Hostel 4' THEN 'SR 04'
  WHEN 'Hostel 5' THEN 'SR 05'
  WHEN 'Hostel 6' THEN 'SR 06'
  ELSE pickup_hostel
END;

-- 2. Add coordinates & private handover note to listings
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS pickup_note TEXT NULL;

-- 3. Add agreed handover details to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS handover_lat NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS handover_lng NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS handover_spot_name TEXT NULL,
ADD COLUMN IF NOT EXISTS handover_agreed_at TIMESTAMPTZ NULL;
