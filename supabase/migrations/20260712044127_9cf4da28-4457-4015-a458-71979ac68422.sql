CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.reminder_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_lead_minutes integer NOT NULL DEFAULT 10 CHECK (medication_lead_minutes BETWEEN 0 AND 240),
  appointment_lead_minutes integer NOT NULL DEFAULT 120 CHECK (appointment_lead_minutes BETWEEN 0 AND 1440),
  wake_hour integer NOT NULL DEFAULT 7 CHECK (wake_hour BETWEEN 4 AND 11),
  sleep_hour integer NOT NULL DEFAULT 23 CHECK (sleep_hour BETWEEN 20 AND 26),
  daily_repeat_days integer NOT NULL DEFAULT 30 CHECK (daily_repeat_days BETWEEN 7 AND 90),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_preferences TO authenticated;
GRANT ALL ON public.reminder_preferences TO service_role;

ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reminder prefs"
  ON public.reminder_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own reminder prefs"
  ON public.reminder_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reminder prefs"
  ON public.reminder_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reminder prefs"
  ON public.reminder_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_reminder_preferences_updated_at
  BEFORE UPDATE ON public.reminder_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();