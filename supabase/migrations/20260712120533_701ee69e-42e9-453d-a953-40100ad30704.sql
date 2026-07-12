
-- =========================================================
-- Concurrency-safe booking helpers
-- =========================================================

-- 1) Serialize concurrent bookings for the same (doctor, date, time)
--    via a transaction-scoped advisory lock, then double-check.
CREATE OR REPLACE FUNCTION public._assert_slot_free(
  _doctor_id uuid,
  _date date,
  _time time,
  _exclude_appt_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
BEGIN
  IF _doctor_id IS NULL OR _date IS NULL OR _time IS NULL THEN
    RETURN; -- nothing to guard
  END IF;

  -- Deterministic lock key per (doctor, date, time). Auto-released at COMMIT/ROLLBACK.
  _key := _doctor_id::text || '|' || _date::text || '|' || _time::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(_key, 0));

  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE doctor_id = _doctor_id
      AND appointment_date = _date
      AND appointment_time = _time
      AND status IN ('new','confirmed','completed')
      AND (_exclude_appt_id IS NULL OR id <> _exclude_appt_id)
  ) THEN
    RAISE EXCEPTION 'هذا الموعد محجوز بالفعل، الرجاء اختيار وقت آخر'
      USING ERRCODE = 'unique_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_slot_free(uuid, date, time, uuid) FROM PUBLIC, anon, authenticated;

-- 2) Harden book_slot: lock slot row + advisory lock on (doctor,date,time),
--    then re-check both before inserting.
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

  -- (a) Row-level lock on the slot itself
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

  -- (b) Cross-check the appointments table with a per-slot advisory lock
  PERFORM public._assert_slot_free(v_slot.doctor_id, v_slot.slot_date, v_slot.start_time, NULL);

  -- (c) Atomic insert + slot update inside the same transaction.
  --     The partial unique index on appointments is the last-line guarantee.
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

-- Preserve prior EXECUTE grants on book_slot
REVOKE ALL ON FUNCTION public.book_slot(uuid, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, text, text, text, text, text, text, text, uuid) TO anon, authenticated;

-- 3) Harden reschedule_appointment_by_ref with row lock + advisory lock
CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_ref(
  _ref text,
  _phone text,
  _new_date date,
  _new_time time,
  _reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _doctor uuid;
  _reason_val text := public.normalize_reason(_reason);
BEGIN
  IF _ref IS NULL OR length(regexp_replace(_ref,'[^0-9a-fA-F]','','g')) < 8 THEN
    RETURN false;
  END IF;

  -- Lock the target appointment row for the duration of the transaction
  SELECT a.id, a.doctor_id INTO _id, _doctor
  FROM public.appointments a
  WHERE lower(replace(a.id::text,'-','')) LIKE lower(_ref) || '%'
    AND regexp_replace(a.patient_phone,'\D','','g') = regexp_replace(_phone,'\D','','g')
    AND a.status IN ('new','confirmed')
  LIMIT 1
  FOR UPDATE;

  IF _id IS NULL THEN RETURN false; END IF;

  IF (_new_date + _new_time) <= now() THEN
    RAISE EXCEPTION 'الموعد الجديد يجب أن يكون في المستقبل' USING ERRCODE='check_violation';
  END IF;

  -- Serialize concurrent reschedules onto the same target slot
  PERFORM public._assert_slot_free(_doctor, _new_date, _new_time, _id);

  IF _reason_val IS NULL OR length(_reason_val) = 0 THEN
    _reason_val := 'إعادة جدولة من المراجع';
  END IF;

  PERFORM set_config('app.change_reason', _reason_val, true);
  UPDATE public.appointments
     SET appointment_date = _new_date,
         appointment_time = _new_time,
         status = 'new'
   WHERE id = _id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.reschedule_appointment_by_ref(text, text, date, time, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_ref(text, text, date, time, text) TO anon, authenticated;
