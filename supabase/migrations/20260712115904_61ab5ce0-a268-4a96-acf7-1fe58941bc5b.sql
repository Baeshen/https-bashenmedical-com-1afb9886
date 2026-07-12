
-- Drop the duplicate index (keep the newer, explicit one)
DROP INDEX IF EXISTS public.appointments_doctor_slot_unique_active;

-- Ensure the canonical partial unique index exists
DROP INDEX IF EXISTS public.appointments_doctor_slot_active_uidx;
CREATE UNIQUE INDEX appointments_doctor_slot_active_uidx
  ON public.appointments (doctor_id, appointment_date, appointment_time)
  WHERE doctor_id IS NOT NULL
    AND status IN ('new','confirmed','completed');

COMMENT ON INDEX public.appointments_doctor_slot_active_uidx IS
  'Prevents double-booking: only one active (new/confirmed/completed) appointment per doctor per slot. Cancelled/no_show rows are excluded so the slot can be rebooked.';
