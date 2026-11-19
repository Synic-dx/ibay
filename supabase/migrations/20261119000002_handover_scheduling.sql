-- =====================================================================
-- Handover Scheduling and Seller Availability Windows
-- =====================================================================

-- 1. Add pickup_slots to listings for seller preferred availability windows
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS pickup_slots text[] NOT NULL DEFAULT '{}';

-- 2. Add scheduled handover tracking to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS handover_scheduled_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS handover_status text NOT NULL DEFAULT 'proposed',
ADD COLUMN IF NOT EXISTS handover_proposed_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;

-- 3. Add constraint for handover_status if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_handover_status'
  ) THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_handover_status
    CHECK (handover_status IN ('proposed', 'confirmed', 'rescheduled', 'completed'));
  END IF;
END $$;
