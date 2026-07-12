-- 1) Unique partial index on appointments: prevent double-booking for active statuses
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_slot_active_uidx
  ON public.appointments (doctor_id, appointment_date, appointment_time)
  WHERE doctor_id IS NOT NULL
    AND status IN ('new','confirmed','completed');

-- 2) Unique index on availability_slots
CREATE UNIQUE INDEX IF NOT EXISTS availability_slots_doctor_date_start_uidx
  ON public.availability_slots (doctor_id, slot_date, start_time)
  WHERE doctor_id IS NOT NULL;

-- 3) cancelled_at column + trigger
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_appointment_cancelled_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_appointment_cancelled_at ON public.appointments;
CREATE TRIGGER trg_sync_appointment_cancelled_at
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_cancelled_at();

-- Backfill cancelled_at from audit log for existing rows
UPDATE public.appointments a
SET cancelled_at = sub.changed_at
FROM (
  SELECT DISTINCT ON (appointment_id) appointment_id, changed_at
  FROM public.appointment_audit
  WHERE new_status = 'cancelled'
  ORDER BY appointment_id, changed_at DESC
) sub
WHERE a.id = sub.appointment_id
  AND a.status = 'cancelled'
  AND a.cancelled_at IS NULL;