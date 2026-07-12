
CREATE TABLE public.patient_immunizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  dose_number INTEGER,
  administered_on DATE NOT NULL,
  next_due_on DATE,
  provider_name TEXT,
  lot_number TEXT,
  site TEXT,
  route TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_immunizations TO authenticated;
GRANT ALL ON public.patient_immunizations TO service_role;

ALTER TABLE public.patient_immunizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients read own immunizations"
  ON public.patient_immunizations FOR SELECT TO authenticated
  USING (patient_id = public.get_my_patient_id());

CREATE POLICY "staff manage immunizations"
  ON public.patient_immunizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'reception'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'reception'::app_role));

CREATE TRIGGER update_patient_immunizations_updated_at
  BEFORE UPDATE ON public.patient_immunizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_patient_immunizations_patient ON public.patient_immunizations(patient_id, administered_on DESC);
