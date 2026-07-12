
-- 1) Permissions catalog
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  category text NOT NULL,
  description_ar text NOT NULL,
  description_en text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 2) Role -> Permission mapping
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 3) Permission-check helper
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id,'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = _user_id AND rp.permission_key = _permission_key
    );
$$;

-- 4) RPC: catalog
CREATE OR REPLACE FUNCTION public.list_permissions_catalog()
RETURNS TABLE(key text, category text, description_ar text, description_en text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT p.key, p.category, p.description_ar, p.description_en
    FROM public.permissions p
    ORDER BY p.category, p.key;
END $$;

-- 5) RPC: matrix
CREATE OR REPLACE FUNCTION public.list_role_permissions_matrix()
RETURNS TABLE(role public.app_role, permission_key text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT rp.role, rp.permission_key FROM public.role_permissions rp;
END $$;

-- 6) RPC: toggle role permission
CREATE OR REPLACE FUNCTION public.set_role_permission(_role public.app_role, _permission_key text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _role IN ('super_admin','admin') AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'only super_admin may modify this role' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE key = _permission_key) THEN
    RAISE EXCEPTION 'unknown permission %', _permission_key USING ERRCODE='foreign_key_violation';
  END IF;

  IF _enabled THEN
    INSERT INTO public.role_permissions(role, permission_key, created_by)
    VALUES (_role, _permission_key, auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role = _role AND permission_key = _permission_key;
  END IF;

  PERFORM public.log_security_event(
    CASE WHEN _enabled THEN 'role_permission_granted' ELSE 'role_permission_revoked' END,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('role', _role, 'permission', _permission_key)
  );
END $$;

-- 7) Seed catalog
INSERT INTO public.permissions(key, category, description_ar, description_en) VALUES
  ('appointments.view','المواعيد','عرض المواعيد','View appointments'),
  ('appointments.manage','المواعيد','إنشاء/تعديل/إلغاء المواعيد','Manage appointments'),
  ('patients.view','المرضى','عرض ملفات المرضى','View patient records'),
  ('patients.manage','المرضى','إنشاء وتعديل ملفات المرضى','Manage patient profiles'),
  ('patients.clinical.write','المرضى','تحرير البيانات السريرية والوصفات','Write clinical data'),
  ('doctors.manage','الأطباء','إدارة الأطباء والتخصصات والجداول','Manage doctors and schedules'),
  ('pharmacy.view','الصيدلية','عرض المخزون والوصفات','View pharmacy'),
  ('pharmacy.manage','الصيدلية','إدارة المخزون والوصفات','Manage pharmacy'),
  ('inventory.manage','المخزون','المستودع وطلبات الشراء','Manage inventory and PRs'),
  ('nurses.manage','التمريض','إدارة الورديات واستدعاءات المرضى','Manage nursing shifts and calls'),
  ('hr.manage','الموارد البشرية','الموظفون والحضور والإجازات والرواتب','Manage HR'),
  ('reports.view','التقارير','عرض التقارير ولوحات KPI','View reports and KPIs'),
  ('audit.view','التدقيق','عرض سجل التدقيق الأمني','View audit log'),
  ('settings.manage','الإعدادات','تعديل إعدادات المجمع','Manage clinic settings'),
  ('rbac.manage','الصلاحيات','إدارة الأدوار والصلاحيات','Manage roles and permissions'),
  ('notifications.manage','الإشعارات','إدارة القوالب وقوائم الإرسال','Manage notifications')
ON CONFLICT (key) DO NOTHING;

-- 8) Seed default role -> permission mapping
INSERT INTO public.role_permissions(role, permission_key) VALUES
  ('admin','appointments.view'),('admin','appointments.manage'),
  ('admin','patients.view'),('admin','patients.manage'),
  ('admin','doctors.manage'),
  ('admin','pharmacy.view'),('admin','pharmacy.manage'),
  ('admin','inventory.manage'),
  ('admin','nurses.manage'),('admin','hr.manage'),
  ('admin','reports.view'),('admin','audit.view'),
  ('admin','settings.manage'),('admin','rbac.manage'),('admin','notifications.manage'),
  ('reception','appointments.view'),('reception','appointments.manage'),
  ('reception','patients.view'),('reception','patients.manage'),
  ('doctor','appointments.view'),('doctor','patients.view'),('doctor','patients.clinical.write'),
  ('pharmacy','pharmacy.view'),('pharmacy','pharmacy.manage'),('pharmacy','inventory.manage')
ON CONFLICT DO NOTHING;
