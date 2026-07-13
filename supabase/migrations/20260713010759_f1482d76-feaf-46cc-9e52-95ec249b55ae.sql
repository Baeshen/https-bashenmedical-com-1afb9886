-- Restrict anonymous SELECT on availability_slots to only 'available' slots,
-- so booked slots (which carry appointment_id) are not exposed publicly.
DROP POLICY IF EXISTS availability_slots_public_read ON public.availability_slots;

CREATE POLICY availability_slots_public_read
  ON public.availability_slots
  FOR SELECT
  TO anon, authenticated
  USING (status = 'available');