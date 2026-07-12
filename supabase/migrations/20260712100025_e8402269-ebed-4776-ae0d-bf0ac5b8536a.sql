
-- lab_reports: patients only see released rows; staff see everything
DROP POLICY IF EXISTS "Patients read own labs" ON public.lab_reports;

CREATE POLICY "Patients read own labs"
ON public.lab_reports
FOR SELECT
TO authenticated
USING (
  (
    released_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = lab_reports.patient_id
        AND p.profile_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'doctor'::app_role)
);

-- radiology_reports: same pattern
DROP POLICY IF EXISTS "Patients read own radiology" ON public.radiology_reports;

CREATE POLICY "Patients read own radiology"
ON public.radiology_reports
FOR SELECT
TO authenticated
USING (
  (
    released_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = radiology_reports.patient_id
        AND p.profile_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'doctor'::app_role)
);
