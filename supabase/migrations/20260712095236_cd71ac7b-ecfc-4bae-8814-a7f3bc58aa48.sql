
-- Add released_at column to lab_reports and radiology_reports
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.radiology_reports ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Backfill: rows with status = 'released' or 'completed' get released_at = updated_at
UPDATE public.lab_reports
SET released_at = updated_at
WHERE released_at IS NULL AND status IN ('released','completed','final');

UPDATE public.radiology_reports
SET released_at = updated_at
WHERE released_at IS NULL AND status IN ('released','completed','final');

-- Helpful indexes for patient-portal queries
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient_released
  ON public.lab_reports (patient_id, released_at DESC)
  WHERE released_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radiology_reports_patient_released
  ON public.radiology_reports (patient_id, released_at DESC)
  WHERE released_at IS NOT NULL;

COMMENT ON COLUMN public.lab_reports.released_at IS 'Timestamp when the report was released to the patient. NULL = not yet visible to patient portal.';
COMMENT ON COLUMN public.radiology_reports.released_at IS 'Timestamp when the report was released to the patient. NULL = not yet visible to patient portal.';
