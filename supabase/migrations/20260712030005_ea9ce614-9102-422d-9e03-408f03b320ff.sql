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
             'patient_name', a.patient_name,
             'patient_phone', a.patient_phone,
             'appointment_date', a.appointment_date,
             'appointment_time', a.appointment_time,
             'reason', a.reason,
             'notes', a.notes,
             'specialty_id', a.specialty_id,
             'doctor_id', a.doctor_id,
             'specialty_name_ar', s.name_ar,
             'specialty_name_en', s.name_en,
             'doctor_name_ar', d.name_ar,
             'doctor_name_en', d.name_en,
             'reminder_24h', a.reminder_24h,
             'reminder_2h', a.reminder_2h,
             'cancel_reason', a.cancel_reason,
             'cancelled_at', a.cancelled_at
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