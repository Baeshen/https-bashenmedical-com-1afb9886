ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_default_branch_id_idx
  ON public.profiles(default_branch_id);