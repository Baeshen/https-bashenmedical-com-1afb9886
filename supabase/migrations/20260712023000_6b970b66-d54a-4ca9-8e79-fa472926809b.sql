
-- 1) Home care requests table (separate from appointments)
CREATE TABLE public.home_care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  patient_phone text NOT NULL,
  service text,
  address text,
  notes text,
  preferred_date date,
  preferred_time time,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hc_status_chk CHECK (status IN ('new','confirmed','in_progress','completed','cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_care_requests TO authenticated;
GRANT INSERT ON public.home_care_requests TO anon;
GRANT ALL ON public.home_care_requests TO service_role;

ALTER TABLE public.home_care_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_insert_public ON public.home_care_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(patient_name)) BETWEEN 2 AND 120
    AND length(btrim(patient_phone)) BETWEEN 6 AND 32
  );

CREATE POLICY hc_staff_read ON public.home_care_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY hc_staff_update ON public.home_care_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'reception')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY hc_admin_delete ON public.home_care_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_hc_set_updated_at
  BEFORE UPDATE ON public.home_care_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_hc_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.home_care_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE INDEX idx_hc_phone ON public.home_care_requests (regexp_replace(patient_phone,'\D','','g'));
CREATE INDEX idx_hc_status ON public.home_care_requests (status);
CREATE INDEX idx_hc_created ON public.home_care_requests (created_at DESC);


-- 2) Unified public tracking by phone (across all request types)
CREATE OR REPLACE FUNCTION public.track_orders_by_phone(_phone text)
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _p text := regexp_replace(coalesce(_phone,''),'\D','','g');
BEGIN
  IF length(_p) < 6 THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'appointment'::text,
         a.id,
         substring(replace(a.id::text,'-','') for 8),
         COALESCE(s.name_ar, 'موعد طبي'),
         a.status::text,
         a.created_at,
         (a.appointment_date + a.appointment_time)::timestamptz,
         jsonb_build_object(
           'doctor_ar', d.name_ar,
           'specialty_ar', s.name_ar,
           'branch_id', a.branch_id,
           'reason', a.reason
         )
  FROM public.appointments a
  LEFT JOIN public.specialties s ON s.id = a.specialty_id
  LEFT JOIN public.doctors d ON d.id = a.doctor_id
  WHERE regexp_replace(a.patient_phone,'\D','','g') = _p

  UNION ALL
  SELECT 'pharmacy'::text,
         mo.id,
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
  WHERE regexp_replace(mo.patient_phone,'\D','','g') = _p

  UNION ALL
  SELECT 'second_opinion'::text,
         so.id,
         substring(replace(so.id::text,'-','') for 8),
         'رأي طبي ثاني — ' || COALESCE(so.specialty,''),
         so.status,
         so.created_at,
         NULL::timestamptz,
         jsonb_build_object('specialty', so.specialty, 'email', so.email)
  FROM public.second_opinion_requests so
  WHERE regexp_replace(so.phone,'\D','','g') = _p

  UNION ALL
  SELECT 'home_care'::text,
         hc.id,
         substring(replace(hc.id::text,'-','') for 8),
         COALESCE(hc.service, 'رعاية منزلية'),
         hc.status,
         hc.created_at,
         CASE WHEN hc.preferred_date IS NOT NULL
              THEN (hc.preferred_date + COALESCE(hc.preferred_time,'00:00'::time))::timestamptz
              ELSE NULL END,
         jsonb_build_object('address', hc.address, 'notes', hc.notes)
  FROM public.home_care_requests hc
  WHERE regexp_replace(hc.patient_phone,'\D','','g') = _p

  ORDER BY created_at DESC
  LIMIT 200;
END $$;

GRANT EXECUTE ON FUNCTION public.track_orders_by_phone(text) TO anon, authenticated;


-- 3) Patient-visible audit history for an appointment (by ref+phone)
CREATE OR REPLACE FUNCTION public.list_appointment_audit_by_ref(_ref text, _phone text)
RETURNS TABLE(
  changed_at timestamptz,
  old_status text,
  new_status text,
  old_notes text,
  new_notes text,
  reason text,
  actor_kind text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _ref IS NULL OR length(regexp_replace(_ref,'[^0-9a-fA-F]','','g')) < 8 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT au.changed_at,
         au.old_status::text,
         au.new_status::text,
         au.old_notes,
         au.new_notes,
         au.reason,
         CASE
           WHEN au.changed_by IS NULL THEN 'self_service'
           WHEN public.has_role(au.changed_by,'admin')
             OR public.has_role(au.changed_by,'reception')
             OR public.has_role(au.changed_by,'super_admin') THEN 'staff'
           ELSE 'system'
         END
  FROM public.appointment_audit au
  JOIN public.appointments a ON a.id = au.appointment_id
  WHERE lower(replace(a.id::text,'-','')) LIKE lower(_ref) || '%'
    AND regexp_replace(a.patient_phone,'\D','','g') = regexp_replace(_phone,'\D','','g')
  ORDER BY au.changed_at DESC
  LIMIT 100;
END $$;

GRANT EXECUTE ON FUNCTION public.list_appointment_audit_by_ref(text, text) TO anon, authenticated;
