ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_idempotency_key_unique
  ON public.appointments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;