-- Migration: Add OTP verification columns and atomic verification RPC
-- Approach 1: Consistent Buyer-Held 6-digit OTP (Delivery & Return)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS delivery_otp_plain text NULL,
  ADD COLUMN IF NOT EXISTS return_otp_hash text NULL,
  ADD COLUMN IF NOT EXISTS return_otp_plain text NULL,
  ADD COLUMN IF NOT EXISTS otp_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until timestamptz NULL;

-- Function: verify_handover_otp
-- Validates candidate OTP hash against target step, enforces 5-attempt brute-force throttling,
-- records handover check, and atomically advances stage.
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
    -- Increment attempts
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
