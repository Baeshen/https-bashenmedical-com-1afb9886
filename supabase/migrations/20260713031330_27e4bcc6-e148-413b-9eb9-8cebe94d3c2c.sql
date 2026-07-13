ALTER TABLE public.intro_settings
  ADD COLUMN IF NOT EXISTS prefetch_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prefetch_lead_ms integer NOT NULL DEFAULT 1500;

ALTER TABLE public.intro_settings
  DROP CONSTRAINT IF EXISTS intro_settings_prefetch_lead_ms_range;
ALTER TABLE public.intro_settings
  ADD CONSTRAINT intro_settings_prefetch_lead_ms_range
  CHECK (prefetch_lead_ms >= 0 AND prefetch_lead_ms <= 10000);