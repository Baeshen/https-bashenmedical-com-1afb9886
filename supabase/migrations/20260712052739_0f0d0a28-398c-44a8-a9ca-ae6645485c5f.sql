
-- ===== Pharmacy module =====

-- 1) inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  sku TEXT,
  barcode TEXT,
  form TEXT,           -- tablet, syrup, injection, etc.
  unit TEXT,           -- box, bottle, vial, etc.
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  price NUMERIC(10,2),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory: staff read"
ON public.inventory_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'pharmacy')
  OR public.has_role(auth.uid(), 'reception')
);
CREATE POLICY "Inventory: pharmacy manage"
ON public.inventory_items FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'pharmacy')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'pharmacy')
);

CREATE INDEX IF NOT EXISTS idx_inv_branch_expiry ON public.inventory_items(branch_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_inv_branch_name ON public.inventory_items(branch_id, name_ar);
DROP TRIGGER IF EXISTS trg_inv_updated ON public.inventory_items;
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2) stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out','adjust','waste','transfer')),
  quantity_delta INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movements: staff read"
ON public.stock_movements FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'pharmacy')
  OR public.has_role(auth.uid(), 'reception')
);
CREATE POLICY "Movements: pharmacy write"
ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'pharmacy')
);
CREATE POLICY "Movements: admin delete"
ON public.stock_movements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_move_item_time ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_move_branch_time ON public.stock_movements(branch_id, created_at DESC);

-- Auto-apply movement to inventory quantity
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.inventory_items
     SET quantity = quantity + NEW.quantity_delta
   WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();


-- 3) Prescriptions — pharmacy review fields
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pharmacy_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (pharmacy_status IN ('pending','approved','rejected','needs_info')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispense_qty INTEGER;

CREATE INDEX IF NOT EXISTS idx_rx_pharmacy_status ON public.prescriptions(pharmacy_status, created_at DESC);

-- Allow pharmacy role to read prescriptions
DROP POLICY IF EXISTS "Pharmacy reads prescriptions" ON public.prescriptions;
CREATE POLICY "Pharmacy reads prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'pharmacy') OR public.has_role(auth.uid(), 'super_admin'));

-- Pharmacy review RPC (SECURITY DEFINER — only touches pharmacy fields and stock movement)
CREATE OR REPLACE FUNCTION public.pharmacy_review_prescription(
  _id UUID,
  _decision TEXT,
  _notes TEXT DEFAULT NULL,
  _item_id UUID DEFAULT NULL,
  _quantity INTEGER DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rx public.prescriptions%ROWTYPE;
  _actor UUID := auth.uid();
BEGIN
  IF _actor IS NULL OR NOT (
    public.has_role(_actor, 'admin')
    OR public.has_role(_actor, 'super_admin')
    OR public.has_role(_actor, 'pharmacy')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _decision NOT IN ('approved','rejected','needs_info') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO _rx FROM public.prescriptions WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescription not found';
  END IF;

  UPDATE public.prescriptions
     SET pharmacy_status = _decision,
         reviewed_by = _actor,
         reviewed_at = now(),
         review_notes = _notes
   WHERE id = _id;

  -- On approval + linked inventory item + quantity, deduct stock
  IF _decision = 'approved'
     AND COALESCE(_item_id, _rx.item_id) IS NOT NULL
     AND COALESCE(_quantity, _rx.dispense_qty, 0) > 0 THEN
    INSERT INTO public.stock_movements
      (item_id, branch_id, movement_type, quantity_delta, reason, reference, created_by)
    VALUES
      (COALESCE(_item_id, _rx.item_id),
       _rx.branch_id,
       'out',
       -1 * COALESCE(_quantity, _rx.dispense_qty),
       'صرف وصفة طبية',
       'RX-' || substring(replace(_id::text,'-','') for 8),
       _actor);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'status', _decision);
END $$;

GRANT EXECUTE ON FUNCTION public.pharmacy_review_prescription(UUID, TEXT, TEXT, UUID, INTEGER) TO authenticated;

-- List pending pharmacy prescriptions (staff only)
CREATE OR REPLACE FUNCTION public.list_pharmacy_prescriptions(_branch_id UUID DEFAULT NULL, _status TEXT DEFAULT 'pending')
RETURNS TABLE(
  id UUID,
  patient_id UUID,
  patient_name TEXT,
  doctor_id UUID,
  doctor_name TEXT,
  medication TEXT,
  dosage TEXT,
  instructions TEXT,
  pharmacy_status TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  branch_id UUID,
  item_id UUID,
  dispense_qty INTEGER,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'pharmacy')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id,
         r.patient_id,
         p.full_name,
         r.doctor_id,
         d.name_ar,
         r.medication,
         r.dosage,
         r.instructions,
         r.pharmacy_status,
         r.review_notes,
         r.reviewed_at,
         r.branch_id,
         r.item_id,
         r.dispense_qty,
         r.created_at
  FROM public.prescriptions r
  LEFT JOIN public.patients p ON p.id = r.patient_id
  LEFT JOIN public.doctors d  ON d.id = r.doctor_id
  WHERE (_status IS NULL OR _status = 'all' OR r.pharmacy_status = _status)
    AND (_branch_id IS NULL OR r.branch_id = _branch_id OR r.branch_id IS NULL)
  ORDER BY r.created_at DESC
  LIMIT 300;
END $$;

GRANT EXECUTE ON FUNCTION public.list_pharmacy_prescriptions(UUID, TEXT) TO authenticated;
