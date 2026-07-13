-- Data API GRANTs for public browsing of specialties/doctors.
-- Policies already allow anon SELECT on active rows (is_active = true);
-- PostgREST still needs explicit table-level privileges to serve them.

GRANT SELECT ON public.specialties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialties TO authenticated;
GRANT ALL ON public.specialties TO service_role;

GRANT SELECT ON public.doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;