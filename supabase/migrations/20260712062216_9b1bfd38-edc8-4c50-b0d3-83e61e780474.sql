-- =========================================================
-- M2: Availability slots + atomic booking RPC
-- =========================================================

-- 1) Table
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','booked','blocked')),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_slots_time_valid CHECK (end_time > start_time)
);

-- Prevent duplicate/overlapping slot definitions per doctor+day+start
CREATE UNIQUE INDEX IF NOT EXISTS availability_slots_doctor_date_start_uniq
  ON public.availability_slots (doctor_id, slot_date, start_time);

CREATE INDEX IF NOT EXISTS availability_slots_lookup_idx
  ON public.availability_slots (doctor_id, slot_date, status);

CREATE INDEX IF NOT EXISTS availability_slots_branch_date_idx
  ON public.availability_slots (branch_id, slot_date);

-- 2) GRANTS (required)
GRANT SELECT ON public.availability_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;

-- 3) RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous booking widget) can read available slots
DROP POLICY IF EXISTS "availability_slots_public_read" ON public.availability_slots;
CREATE POLICY "availability_slots_public_read"
  ON public.availability_slots FOR SELECT
  USING (true);

-- Only staff can manage slots
DROP POLICY IF EXISTS "availability_slots_staff_manage" ON public.availability_slots;
CREATE POLICY "availability_slots_staff_manage"
  ON public.availability_slots FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reception')
    OR public.has_role(auth.uid(), 'doctor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reception')
    OR public.has_role(auth.uid(), 'doctor')
  );

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS availability_slots_set_updated_at ON public.availability_slots;
CREATE TRIGGER availability_slots_set_updated_at
  BEFORE UPDATE ON public.availability_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Realtime
ALTER TABLE public.availability_slots REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'availability_slots'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots';
  END IF;
END$$;

-- 6) Atomic booking RPC
-- Locks the slot row FOR UPDATE, verifies it's still available,
-- creates the appointment, marks the slot as booked, and returns the appointment id.
CREATE OR REPLACE FUNCTION public.book_slot(
  p_slot_id uuid,
  p_patient_name text,
  p_patient_phone text,
  p_patient_email text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_patient_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.availability_slots%ROWTYPE;
  v_appt_id uuid;
BEGIN
  IF p_slot_id IS NULL THEN
    RAISE EXCEPTION 'slot_required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_patient_name), '') = '' THEN
    RAISE EXCEPTION 'patient_name_required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_patient_phone), '') = '' THEN
    RAISE EXCEPTION 'patient_phone_required' USING ERRCODE = '22023';
  END IF;

  -- Atomic lock on the target slot
  SELECT * INTO v_slot
    FROM public.availability_slots
   WHERE id = p_slot_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_slot.status <> 'available' THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23514';
  END IF;

  IF (v_slot.slot_date + v_slot.start_time) < now() THEN
    RAISE EXCEPTION 'slot_in_past' USING ERRCODE = '22008';
  END IF;

  INSERT INTO public.appointments (
    patient_name, patient_phone, patient_email, national_id, gender,
    doctor_id, branch_id,
    appointment_date, appointment_time,
    reason, notes, status, patient_id
  ) VALUES (
    btrim(p_patient_name), btrim(p_patient_phone), p_patient_email, p_national_id, p_gender,
    v_slot.doctor_id, v_slot.branch_id,
    v_slot.slot_date, v_slot.start_time,
    p_reason, p_notes, 'confirmed', p_patient_id
  )
  RETURNING id INTO v_appt_id;

  UPDATE public.availability_slots
     SET status = 'booked',
         appointment_id = v_appt_id,
         updated_at = now()
   WHERE id = v_slot.id;

  RETURN v_appt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_slot(uuid,text,text,text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid,text,text,text,text,text,text,text,uuid)
  TO anon, authenticated, service_role;

-- 7) Release RPC — reopens a slot when an appointment is cancelled/rescheduled
CREATE OR REPLACE FUNCTION public.release_slot(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_appointment_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.availability_slots
     SET status = 'available',
         appointment_id = NULL,
         updated_at = now()
   WHERE appointment_id = p_appointment_id
     AND status = 'booked';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.release_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_slot(uuid)
  TO authenticated, service_role;
