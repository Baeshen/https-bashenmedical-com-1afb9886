-- Add WITH CHECK to 8 UPDATE policies that only had USING.
-- Without WITH CHECK, a caller could pass the USING gate on the OLD row and
-- then mutate the ownership/branch key (patient_id, branch_id, id) to a value
-- they don't own — a silent authorization bypass. Mirroring USING as WITH CHECK
-- forces the same predicate to hold on the NEW row after the update.

-- Clinical child tables — same predicate: writer must have clinical access to the patient.
DROP POLICY IF EXISTS "allergies upd" ON public.patient_allergies;
CREATE POLICY "allergies upd" ON public.patient_allergies
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

DROP POLICY IF EXISTS "attach upd" ON public.patient_attachments;
CREATE POLICY "attach upd" ON public.patient_attachments
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

DROP POLICY IF EXISTS "hist upd" ON public.patient_medical_history;
CREATE POLICY "hist upd" ON public.patient_medical_history
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

DROP POLICY IF EXISTS "meds upd" ON public.patient_medications;
CREATE POLICY "meds upd" ON public.patient_medications
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

DROP POLICY IF EXISTS "surg upd" ON public.patient_surgeries;
CREATE POLICY "surg upd" ON public.patient_surgeries
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

DROP POLICY IF EXISTS "visits upd" ON public.patient_visits;
CREATE POLICY "visits upd" ON public.patient_visits
  FOR UPDATE TO authenticated
  USING (public.can_write_patient_clinical(patient_id))
  WITH CHECK (public.can_write_patient_clinical(patient_id));

-- Patients master — staff role + branch access must hold on NEW row too,
-- so a doctor can't move a patient into a branch they don't manage.
DROP POLICY IF EXISTS "patients update staff" ON public.patients;
CREATE POLICY "patients update staff" ON public.patients
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR public.has_role(auth.uid(), 'doctor'::app_role)
     OR public.has_role(auth.uid(), 'reception'::app_role))
    AND public.has_branch_access(auth.uid(), branch_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR public.has_role(auth.uid(), 'doctor'::app_role)
     OR public.has_role(auth.uid(), 'reception'::app_role))
    AND public.has_branch_access(auth.uid(), branch_id)
  );

-- Own profile — prevents a user from rewriting profiles.id to another user's id
-- (which the USING-only check would silently allow after the row hit).
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);