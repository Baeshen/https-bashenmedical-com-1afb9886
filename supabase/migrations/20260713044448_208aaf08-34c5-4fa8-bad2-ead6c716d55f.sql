
-- 1) Table
CREATE TABLE public.appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  preferred_from DATE NOT NULL,
  preferred_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','notified','fulfilled','expired','cancelled')),
  notified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_doctor_status
  ON public.appointment_waitlist (doctor_id, status, created_at)
  WHERE status = 'waiting';

CREATE INDEX idx_waitlist_phone
  ON public.appointment_waitlist (patient_phone);

-- 2) Grants (server-only access via supabaseAdmin)
GRANT ALL ON public.appointment_waitlist TO service_role;

-- 3) RLS enabled with no policies → locks anon/authenticated out;
--    all reads/writes must go through server routes using service_role.
ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;

-- 4) updated_at trigger (reuses existing helper if present, else create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.appointment_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) When an appointment is cancelled or no-show, mark the earliest waiting
--    waitlist entry for the same doctor whose date range covers the freed
--    date as `notified`. Actual notification (WhatsApp/SMS) is out of scope
--    here — this simply flags the entry so staff / a follow-up job can act.
CREATE OR REPLACE FUNCTION public.mark_waitlist_on_slot_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled','no_show')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.doctor_id IS NOT NULL THEN
    UPDATE public.appointment_waitlist w
       SET status = 'notified', notified_at = now()
     WHERE w.id = (
       SELECT id FROM public.appointment_waitlist
        WHERE doctor_id = NEW.doctor_id
          AND status = 'waiting'
          AND NEW.appointment_date BETWEEN preferred_from AND preferred_to
        ORDER BY created_at ASC
        LIMIT 1
     );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_waitlist_on_slot_release ON public.appointments;
CREATE TRIGGER trg_mark_waitlist_on_slot_release
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.mark_waitlist_on_slot_release();
