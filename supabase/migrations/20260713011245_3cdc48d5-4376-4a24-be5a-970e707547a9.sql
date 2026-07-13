
-- 1) Belt-and-suspenders on availability_slots: available AND no appointment linkage
DROP POLICY IF EXISTS availability_slots_public_read ON public.availability_slots;
CREATE POLICY availability_slots_public_read
  ON public.availability_slots
  FOR SELECT
  TO anon, authenticated
  USING (status = 'available' AND appointment_id IS NULL);

-- 2) availability weekly schedule: only for active doctors
DROP POLICY IF EXISTS "read availability" ON public.availability;
CREATE POLICY availability_public_read
  ON public.availability
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = availability.doctor_id
        AND COALESCE(d.is_active, true) = true
    )
  );

-- 3) doctor_branches mapping: only for active doctors
DROP POLICY IF EXISTS "read doctor_branches" ON public.doctor_branches;
CREATE POLICY doctor_branches_public_read
  ON public.doctor_branches
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_branches.doctor_id
        AND COALESCE(d.is_active, true) = true
    )
  );
