
-- =========================================================
-- 1) track_orders_by_phone → summary only (no PII)
-- =========================================================
-- Change signature: drop id + metadata columns to stop leaking PII to anyone
-- who happens to know a patient's phone. Full details now require ref+phone+kind.
DROP FUNCTION IF EXISTS public.track_orders_by_phone(text);

CREATE OR REPLACE FUNCTION public.track_orders_by_phone(_phone text)
RETURNS TABLE(
  kind text,
  reference text,
  title text,
  status text,
  created_at timestamptz,
  scheduled_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _p text := regexp_replace(coalesce(_phone,''),'\D','','g');
BEGIN
  IF length(_p) < 8 THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'appointment'::text,
         substring(replace(a.id::text,'-','') for 8),
         COALESCE(s.name_ar, 'موعد طبي'),
         a.status::text,
         a.created_at,
         (a.appointment_date + a.appointment_time)::timestamptz
  FROM public.appointments a
  LEFT JOIN public.specialties s ON s.id = a.specialty_id
  WHERE regexp_replace(a.patient_phone,'\D','','g') = _p

  UNION ALL
  SELECT 'pharmacy'::text,
         substring(replace(mo.id::text,'-','') for 8),
         'طلب صيدلية',
         mo.status::text,
         mo.created_at,
         NULL::timestamptz
  FROM public.medicine_orders mo
  WHERE regexp_replace(mo.patient_phone,'\D','','g') = _p

  UNION ALL
  SELECT 'second_opinion'::text,
         substring(replace(so.id::text,'-','') for 8),
         'رأي طبي ثاني',
         so.status,
         so.created_at,
         NULL::timestamptz
  FROM public.second_opinion_requests so
  WHERE regexp_replace(so.phone,'\D','','g') = _p

  UNION ALL
  SELECT 'home_care'::text,
         substring(replace(hc.id::text,'-','') for 8),
         COALESCE(hc.service, 'رعاية منزلية'),
         hc.status,
         hc.created_at,
         CASE WHEN hc.preferred_date IS NOT NULL
              THEN (hc.preferred_date + COALESCE(hc.preferred_time,'00:00'::time))::timestamptz
              ELSE NULL END
  FROM public.home_care_requests hc
  WHERE regexp_replace(hc.patient_phone,'\D','','g') = _p

  ORDER BY created_at DESC
  LIMIT 200;
END $$;

REVOKE ALL ON FUNCTION public.track_orders_by_phone(text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_orders_by_phone(text) TO anon, authenticated;


-- =========================================================
-- 2) NEW: get_order_by_ref → full details, requires ref+phone+kind
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_order_by_ref(_ref text, _phone text, _kind text)
RETURNS TABLE(
  kind text,
  id uuid,
  reference text,
  title text,
  status text,
  created_at timestamptz,
  scheduled_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r text := lower(coalesce(_ref,''));
  _p text := regexp_replace(coalesce(_phone,''),'\D','','g');
BEGIN
  -- Same strictness as lookup_appointment / cancel_appointment_by_ref
  IF _ref IS NULL OR length(regexp_replace(_r,'[^0-9a-f]','','g')) < 8 THEN
    RETURN;
  END IF;
  IF length(_p) < 8 THEN
    RETURN;
  END IF;

  IF _kind = 'pharmacy' THEN
    RETURN QUERY
    SELECT 'pharmacy'::text, mo.id,
           substring(replace(mo.id::text,'-','') for 8),
           'طلب صيدلية',
           mo.status::text,
           mo.created_at,
           NULL::timestamptz,
           jsonb_build_object(
             'delivery_type', mo.delivery_type,
             'address', mo.address,
             'district', mo.district,
             'notes', mo.notes
           )
    FROM public.medicine_orders mo
    WHERE substring(replace(mo.id::text,'-','') for 8) = _r
      AND regexp_replace(mo.patient_phone,'\D','','g') = _p
    LIMIT 1;

  ELSIF _kind = 'second_opinion' THEN
    RETURN QUERY
    SELECT 'second_opinion'::text, so.id,
           substring(replace(so.id::text,'-','') for 8),
           'رأي طبي ثاني — ' || COALESCE(so.specialty,''),
           so.status,
           so.created_at,
           NULL::timestamptz,
           jsonb_build_object('specialty', so.specialty, 'email', so.email)
    FROM public.second_opinion_requests so
    WHERE substring(replace(so.id::text,'-','') for 8) = _r
      AND regexp_replace(so.phone,'\D','','g') = _p
    LIMIT 1;

  ELSIF _kind = 'home_care' THEN
    RETURN QUERY
    SELECT 'home_care'::text, hc.id,
           substring(replace(hc.id::text,'-','') for 8),
           COALESCE(hc.service, 'رعاية منزلية'),
           hc.status,
           hc.created_at,
           CASE WHEN hc.preferred_date IS NOT NULL
                THEN (hc.preferred_date + COALESCE(hc.preferred_time,'00:00'::time))::timestamptz
                ELSE NULL END,
           jsonb_build_object('address', hc.address, 'notes', hc.notes)
    FROM public.home_care_requests hc
    WHERE substring(replace(hc.id::text,'-','') for 8) = _r
      AND regexp_replace(hc.patient_phone,'\D','','g') = _p
    LIMIT 1;

  ELSIF _kind = 'appointment' THEN
    RETURN QUERY
    SELECT 'appointment'::text, a.id,
           substring(replace(a.id::text,'-','') for 8),
           COALESCE(s.name_ar, 'موعد طبي'),
           a.status::text,
           a.created_at,
           (a.appointment_date + a.appointment_time)::timestamptz,
           jsonb_build_object(
             'doctor_ar', d.name_ar,
             'specialty_ar', s.name_ar,
             'reason', a.reason
           )
    FROM public.appointments a
    LEFT JOIN public.specialties s ON s.id = a.specialty_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    WHERE substring(replace(a.id::text,'-','') for 8) = _r
      AND regexp_replace(a.patient_phone,'\D','','g') = _p
    LIMIT 1;
  END IF;

  RETURN;
END $$;

REVOKE ALL ON FUNCTION public.get_order_by_ref(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_by_ref(text, text, text) TO anon, authenticated;


-- =========================================================
-- 3) cancel_order_by_ref → tighten ref validation to 8 hex chars
-- =========================================================
CREATE OR REPLACE FUNCTION public.cancel_order_by_ref(
  _ref text,
  _phone text,
  _kind text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r text := lower(coalesce(_ref,''));
  _p text := regexp_replace(coalesce(_phone,''),'\D','','g');
  _target_id uuid;
  _cur_status text;
BEGIN
  -- Match the strictness used across other patient-facing RPCs
  IF _ref IS NULL OR length(regexp_replace(_r,'[^0-9a-f]','','g')) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ref');
  END IF;
  IF length(_p) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;

  IF _kind = 'pharmacy' THEN
    SELECT id, status::text INTO _target_id, _cur_status
    FROM public.medicine_orders
    WHERE substring(replace(id::text,'-','') for 8) = _r
      AND regexp_replace(patient_phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('delivered','cancelled','completed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.medicine_orders
       SET status = 'cancelled',
           notes = COALESCE(notes,'') ||
                   CASE WHEN _reason IS NOT NULL AND length(_reason) > 0
                        THEN E'\n[إلغاء من المريض] ' || _reason ELSE '' END
     WHERE id = _target_id;

  ELSIF _kind = 'second_opinion' THEN
    SELECT id, status INTO _target_id, _cur_status
    FROM public.second_opinion_requests
    WHERE substring(replace(id::text,'-','') for 8) = _r
      AND regexp_replace(phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('closed','answered','cancelled') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.second_opinion_requests
       SET status = 'cancelled'
     WHERE id = _target_id;

  ELSIF _kind = 'home_care' THEN
    SELECT id, status INTO _target_id, _cur_status
    FROM public.home_care_requests
    WHERE substring(replace(id::text,'-','') for 8) = _r
      AND regexp_replace(patient_phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('completed','cancelled','in_progress') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.home_care_requests
       SET status = 'cancelled',
           notes  = COALESCE(notes,'') ||
                    CASE WHEN _reason IS NOT NULL AND length(_reason) > 0
                         THEN E'\n[إلغاء من المريض] ' || _reason ELSE '' END
     WHERE id = _target_id;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unsupported_kind');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _target_id, 'status', 'cancelled');
END $$;

REVOKE ALL ON FUNCTION public.cancel_order_by_ref(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_order_by_ref(text, text, text, text) TO anon, authenticated;
