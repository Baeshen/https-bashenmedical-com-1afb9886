
CREATE TABLE public.intro_settings (
  id text PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  scene_order jsonb NOT NULL DEFAULT '["pulse","brand","services","stats","booking","final"]'::jsonb,
  stat_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  headline_ar text,
  headline_en text,
  tagline_ar text,
  tagline_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.intro_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.intro_settings TO authenticated;
GRANT ALL ON public.intro_settings TO service_role;

ALTER TABLE public.intro_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intro_settings_public_read_active"
  ON public.intro_settings FOR SELECT
  USING (is_active = true);

CREATE POLICY "intro_settings_admin_read_all"
  ON public.intro_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "intro_settings_admin_insert"
  ON public.intro_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "intro_settings_admin_update"
  ON public.intro_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_intro_settings_updated_at
  BEFORE UPDATE ON public.intro_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.intro_settings (id, headline_ar, headline_en, tagline_ar, tagline_en, services, stat_metrics)
VALUES (
  'default',
  'مجمع باعشن الطبي',
  'Baeshen Medical Complex',
  'صحتك… أولويتنا',
  'Your Health, Our Priority',
  '[
    {"id":"clinics","titleAr":"العيادات التخصصية","titleEn":"Specialty Clinics","icon":"Stethoscope"},
    {"id":"internal","titleAr":"الباطنية","titleEn":"Internal Medicine","icon":"HeartPulse"},
    {"id":"pediatrics","titleAr":"طب الأطفال","titleEn":"Pediatrics","icon":"Baby"},
    {"id":"obgyn","titleAr":"النساء والولادة","titleEn":"OB-GYN","icon":"Users"},
    {"id":"dental","titleAr":"طب الأسنان","titleEn":"Dentistry","icon":"Tooth"},
    {"id":"eye","titleAr":"طب العيون","titleEn":"Ophthalmology","icon":"Eye"},
    {"id":"lab","titleAr":"المختبر","titleEn":"Laboratory","icon":"FlaskConical"},
    {"id":"pharmacy","titleAr":"الصيدلية","titleEn":"Pharmacy","icon":"Pill"},
    {"id":"home","titleAr":"الرعاية المنزلية","titleEn":"Home Care","icon":"Home"},
    {"id":"telemed","titleAr":"الاستشارات عن بُعد","titleEn":"Telemedicine","icon":"Video"},
    {"id":"booking","titleAr":"حجز إلكتروني","titleEn":"Online Booking","icon":"CalendarCheck"}
  ]'::jsonb,
  '[
    {"id":"doctors","labelAr":"طبيبًا واستشاريًا","prefix":"+","suffix":"","icon":"Users","source":"قاعدة بيانات المجمع — الأطباء النشطون","live":true},
    {"id":"years","labelAr":"سنوات من الخبرة","value":15,"prefix":"+","suffix":"","icon":"Award","source":"بيانات معتمدة من إدارة المجمع","live":false},
    {"id":"sat","labelAr":"رضا المرضى","value":98,"prefix":"","suffix":"%","icon":"Star","source":"استبيانات رضا المرضى الداخلية","live":false},
    {"id":"care","labelAr":"رعاية طوال الأسبوع","value":7,"prefix":"","suffix":" أيام","icon":"Clock","source":"جدول عمل المجمع الرسمي","live":false}
  ]'::jsonb
);
