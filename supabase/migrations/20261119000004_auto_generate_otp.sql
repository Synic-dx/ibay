-- Migration: Auto-generate 6-digit delivery and return OTP on transaction insert
-- Guarantees that any transaction created across sale, rental, drop or auction always has a valid code.

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

-- Backfill any existing transactions missing delivery OTP
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
