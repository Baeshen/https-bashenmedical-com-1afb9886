
-- ===== Nurses module =====

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 1) nurses
CREATE TABLE IF NOT EXISTS public.nurses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  department TEXT,
  employee_no TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurses TO authenticated;
GRANT ALL ON public.nurses TO service_role;
ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurses: staff read"
ON public.nurses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Nurses: admin manage"
ON public.nurses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_nurses_branch ON public.nurses(branch_id);
DROP TRIGGER IF EXISTS trg_nurses_updated ON public.nurses;
CREATE TRIGGER trg_nurses_updated BEFORE UPDATE ON public.nurses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2) nurse_shifts
CREATE TABLE IF NOT EXISTS public.nurse_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning','evening','night')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_shifts TO authenticated;
GRANT ALL ON public.nurse_shifts TO service_role;
ALTER TABLE public.nurse_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shifts: staff read"
ON public.nurse_shifts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Shifts: admin manage"
ON public.nurse_shifts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_shifts_branch_date ON public.nurse_shifts(branch_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse_date ON public.nurse_shifts(nurse_id, shift_date);
DROP TRIGGER IF EXISTS trg_shifts_updated ON public.nurse_shifts;
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.nurse_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3) nurse_calls
CREATE TABLE IF NOT EXISTS public.nurse_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  room_no TEXT,
  reason TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent','critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  assigned_nurse_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_calls TO authenticated;
GRANT ALL ON public.nurse_calls TO service_role;
ALTER TABLE public.nurse_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calls: staff read"
ON public.nurse_calls FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Calls: staff insert"
ON public.nurse_calls FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Calls: staff update"
ON public.nurse_calls FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Calls: admin delete"
ON public.nurse_calls FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_calls_status_priority ON public.nurse_calls(status, priority, called_at);
CREATE INDEX IF NOT EXISTS idx_calls_branch ON public.nurse_calls(branch_id);
DROP TRIGGER IF EXISTS trg_calls_updated ON public.nurse_calls;
CREATE TRIGGER trg_calls_updated BEFORE UPDATE ON public.nurse_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
