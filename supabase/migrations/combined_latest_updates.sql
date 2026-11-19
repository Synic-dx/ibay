-- =====================================================================
-- Combined Migration Script for Campus Map, Handover Scheduling & OTP
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- Part 1: Campus Map & Residence Roster
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_hostel;
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

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS pickup_note TEXT NULL;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS handover_lat NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS handover_lng NUMERIC(10, 7) NULL,
ADD COLUMN IF NOT EXISTS handover_spot_name TEXT NULL,
ADD COLUMN IF NOT EXISTS handover_agreed_at TIMESTAMPTZ NULL;

-- ---------------------------------------------------------------------
-- Part 2: Handover Scheduling & Seller Availability Windows
-- ---------------------------------------------------------------------

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS pickup_slots text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS handover_scheduled_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS handover_status text NOT NULL DEFAULT 'proposed',
ADD COLUMN IF NOT EXISTS handover_proposed_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;

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

-- ---------------------------------------------------------------------
-- Part 3: Secure Handover & Return OTP Verification
-- ---------------------------------------------------------------------

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS delivery_otp_plain text NULL,
  ADD COLUMN IF NOT EXISTS return_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS return_otp_plain text NULL,
  ADD COLUMN IF NOT EXISTS otp_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until timestamptz NULL;

CREATE OR REPLACE FUNCTION public.verify_handover_otp(
  p_tx uuid,
  p_actor uuid,
  p_candidate_hash text,
  p_step text -- 'pickup' or 'return'
) RETURNS smallint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.transactions;
  v_target_hash text;
  v_step_name text;
  v_last_stage int;
BEGIN
  -- 1. Lock transaction row
  SELECT * INTO t FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IBAY: Deal not found.' USING errcode = 'P0002';
  END IF;

  -- 2. Must be the seller verifying the buyer's code
  IF p_actor <> t.seller_id THEN
    RAISE EXCEPTION 'IBAY: Only the seller can verify the handover OTP.' USING errcode = 'P0003';
  END IF;

  -- 3. Check brute-force lockout
  IF t.otp_attempts >= 5 AND t.otp_locked_until IS NOT NULL AND t.otp_locked_until > now() THEN
    RAISE EXCEPTION 'IBAY: Too many incorrect attempts. Please try again in 15 minutes.' USING errcode = 'P0004';
  END IF;

  -- 4. Check step logic
  v_last_stage := CASE WHEN t.kind = 'rental' THEN 3 ELSE 2 END;
  IF t.stage >= v_last_stage - 1 THEN
    RAISE EXCEPTION 'IBAY: This deal is already completed and ready to rate.' USING errcode = 'P0001';
  END IF;

  IF p_step = 'pickup' THEN
    v_target_hash := t.delivery_otp_hash;
    v_step_name := CASE WHEN t.kind = 'rental' THEN 'Picked up' ELSE 'Handed over' END;
  ELSIF p_step = 'return' THEN
    IF t.kind <> 'rental' THEN
      RAISE EXCEPTION 'IBAY: Returns only apply to rental deals.' USING errcode = 'P0005';
    END IF;
    IF t.stage <> 1 THEN
      RAISE EXCEPTION 'IBAY: Item must be picked up before it can be returned.' USING errcode = 'P0006';
    END IF;
    v_target_hash := t.return_otp_hash;
    v_step_name := 'Returned';
  ELSE
    RAISE EXCEPTION 'IBAY: Invalid step.' USING errcode = 'P0007';
  END IF;

  -- 5. Match check
  IF v_target_hash IS NULL OR p_candidate_hash <> v_target_hash THEN
    UPDATE public.transactions
    SET otp_attempts = otp_attempts + 1,
        otp_locked_until = CASE WHEN otp_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
    WHERE id = p_tx;

    IF t.otp_attempts + 1 >= 5 THEN
      RAISE EXCEPTION 'IBAY: Incorrect OTP. Verification locked for 15 minutes.' USING errcode = 'P0008';
    ELSE
      RAISE EXCEPTION 'IBAY: Incorrect verification code. % attempts remaining.', (5 - (t.otp_attempts + 1)) USING errcode = 'P0009';
    END IF;
  END IF;

  -- 6. Success! Reset attempts, record handover check, advance stage
  INSERT INTO public.handover_checks (transaction_id, by_user, step, photos_taken, money_done)
  VALUES (p_tx, p_actor, v_step_name, true, true);

  UPDATE public.transactions
  SET stage = stage + 1,
      otp_attempts = 0,
      otp_locked_until = NULL
  WHERE id = p_tx;

  IF v_step_name = 'Returned' THEN
    UPDATE public.rental_bookings SET status = 'completed' WHERE transaction_id = p_tx;
  END IF;

  RETURN t.stage + 1;
END $$;

COMMENT ON FUNCTION public.verify_handover_otp IS 'Validates the buyer-held OTP and advances deal stage atomically.';

-- ---------------------------------------------------------------------
-- Part 4: Auto-Generate 6-Digit Delivery & Return OTP Trigger
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_generate_transaction_otp()
RETURNS TRIGGER AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.delivery_otp_plain IS NULL THEN
    v_code := (floor(100000 + random() * 900000))::text;
    NEW.delivery_otp_plain := v_code;
    NEW.delivery_otp_hash := encode(sha256(v_code::bytea), 'hex');
  END IF;

  IF NEW.kind = 'rental' AND NEW.return_otp_plain IS NULL THEN
    v_code := (floor(100000 + random() * 900000))::text;
    NEW.return_otp_plain := v_code;
    NEW.return_otp_hash := encode(sha256(v_code::bytea), 'hex');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_transaction_otp ON public.transactions;
CREATE TRIGGER trg_auto_transaction_otp
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_transaction_otp();

DO $$
DECLARE
  r RECORD;
  v_code text;
BEGIN
  FOR r IN SELECT id FROM public.transactions WHERE delivery_otp_plain IS NULL LOOP
    v_code := (floor(100000 + random() * 900000))::text;
    UPDATE public.transactions
    SET delivery_otp_plain = v_code,
        delivery_otp_hash = encode(sha256(v_code::bytea), 'hex')
    WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Part 5: One account per email (case-insensitive)
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_lowercase;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_lowercase CHECK (email = lower(btrim(email)));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles (lower(email));

-- ---------------------------------------------------------------------
-- Part 6: Update listing with pickup location support
-- ---------------------------------------------------------------------

DO $$
DECLARE
  d text;
  needle text := 'tags           = case when p_patch ? ''tags'' then array(select jsonb_array_elements_text(p_patch->''tags'')) else tags end';
  replacement text := 'tags           = case when p_patch ? ''tags'' then array(select jsonb_array_elements_text(p_patch->''tags'')) else tags end,' || chr(10) ||
                      '    pickup_hostel  = case when p_patch ? ''pickup_hostel'' then p_patch->>''pickup_hostel'' else pickup_hostel end,' || chr(10) ||
                      '    pickup_lat     = case when p_patch ? ''pickup_lat'' then (p_patch->>''pickup_lat'')::numeric else pickup_lat end,' || chr(10) ||
                      '    pickup_lng     = case when p_patch ? ''pickup_lng'' then (p_patch->>''pickup_lng'')::numeric else pickup_lng end,' || chr(10) ||
                      '    pickup_note    = case when p_patch ? ''pickup_note'' then p_patch->>''pickup_note'' else pickup_note end,' || chr(10) ||
                      '    pickup_slots   = case when p_patch ? ''pickup_slots'' then array(select jsonb_array_elements_text(p_patch->''pickup_slots'')) else pickup_slots end';
BEGIN
  d := pg_get_functiondef('public.update_listing(uuid,uuid,timestamptz,jsonb)'::regprocedure);
  IF position(needle in d) > 0 THEN
    EXECUTE replace(d, needle, replacement);
  END IF;
END $$;
