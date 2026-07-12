-- Complaints & suggestions: public submissions + admin management with realtime.

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('CMP-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  patient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  type TEXT NOT NULL CHECK (type IN ('complaint','suggestion','thanks','inquiry')),
  department TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','waiting_patient','resolved','closed')),
  internal_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX complaints_status_idx ON public.complaints (status, created_at DESC);
CREATE INDEX complaints_patient_idx ON public.complaints (patient_user_id, created_at DESC);
CREATE INDEX complaints_phone_idx  ON public.complaints (patient_phone);

GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Patient can read own rows (by user_id when signed in)
CREATE POLICY "patient reads own complaints"
ON public.complaints FOR SELECT TO authenticated
USING (patient_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- Staff can update (admin/reception)
CREATE POLICY "staff updates complaints"
ON public.complaints FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- Signed-in patients can insert own rows
CREATE POLICY "authenticated inserts own complaint"
ON public.complaints FOR INSERT TO authenticated
WITH CHECK (patient_user_id = auth.uid() OR patient_user_id IS NULL);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER complaints_set_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;

-- Public lookup RPC (used by anon submissions to fetch their own by reference+phone)
CREATE OR REPLACE FUNCTION public.lookup_complaint(_ref TEXT, _phone TEXT)
RETURNS TABLE (
  id UUID, reference TEXT, type TEXT, department TEXT, message TEXT,
  status TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.reference, c.type, c.department, c.message,
         c.status, c.created_at, c.updated_at
  FROM public.complaints c
  WHERE c.reference = _ref
    AND regexp_replace(c.patient_phone, '\D', '', 'g')
      = regexp_replace(_phone, '\D', '', 'g')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_complaint(TEXT, TEXT) TO anon, authenticated;