# خطة تطوير «بوابة باشن الطبية المستقبلية» — 15 قسماً

> **آخر تحديث:** 2026-07-12
> **المرجع:** ملف التطوير المرفوع من المستخدم (15 قسماً)
> **المبدأ الحاكم:** مستقبليٌّ وفخم لكن موثوق وسهل — RTL عربي أولاً، تباين عالٍ، احترام `prefers-reduced-motion`.

---

## 🎯 مؤشر التقدم العام

| # | المرحلة | الحالة |
|---|--------|--------|
| 0 | تحصين قاعدة البيانات والتزامن (سابق) | ✅ منجز |
| 1 | الأساس + الهوية البصرية المستقبلية | ✅ منجز |
| 2 | الإنترو + الرئيسية + الإعلانات والعروض | ⬜ لم يبدأ |
| 3 | توليد الصور وربطها بالخدمات | ⬜ لم يبدأ |
| 4 | قسم التجميل والليزر | ⬜ لم يبدأ |
| 5 | ترقية نظام المراجعين + الملف الطبي | ⬜ جزئي |
| 6 | الإشعارات والدفع | ⬜ جزئي |
| 7 | لوحة الأدمن المطوّرة | ⬜ جزئي |
| 8 | المراجعة الأمنية والإطلاق | ⬜ لم يبدأ |

---

## ✅ ما تم إنجازه سابقاً (الأساس التقني)

### أمان قاعدة البيانات والتزامن
- [x] تقييد `EXECUTE` على دوال `SECURITY DEFINER` — `supabase/migrations/20260712115801_*.sql`
- [x] قيد فريد على `appointments (doctor_id, date, time)` لمنع الحجز المزدوج — `supabase/migrations/20260712115904_*.sql`
- [x] عمود `cancelled_at` صريح على `appointments` مع تحديث منطق الإلغاء
- [x] Soft delete للمرضى عبر `is_active` — `src/lib/patients-mgmt.functions.ts`, `src/routes/_authenticated/patients.index.tsx`
- [x] معاملة ذرّية لـ `book_slot` + `_assert_slot_free` + Advisory locks — `supabase/migrations/20260712120533_*.sql`
- [x] اختبارات تزامن Python (25 طلب متوازٍ) — `scripts/tests/concurrency_book_slot.py`, `scripts/tests/concurrency_direct_insert.py`

### بنية موجودة نبني عليها
- [x] Auth عبر Supabase + RBAC + `user_roles` مع `has_role` — `src/integrations/supabase/`
- [x] Audit logs — `src/lib/audit-log.server.ts`, جدول `security_audit_log`
- [x] IntroOverlay أوّلي — `src/components/IntroOverlay.tsx`
- [x] MotionToggle — `src/components/MotionToggle.tsx`
- [x] PageShell — `src/components/PageShell.tsx`
- [x] i18n عربي/إنجليزي — `src/lib/i18n.tsx`
- [x] شاشات: خدمات، فروع، أطباء، تخصصات، طب عن بُعد، زيارة منزلية، صيدلية، طلباتي، تقييم، شكاوى…

---

## 📋 المراحل التفصيلية

### المرحلة 1 — الأساس + الهوية البصرية المستقبلية (أقسام 1، 3)

**الحالة:** ⬜ لم يبدأ · **مدة تقديرية:** جلسة واحدة

**المهام:**
- [x] تحديث `src/styles.css` — طبقة `.futuristic` بألوان نيون (`#00D9C0`، `#7B61FF`، `#22E8FF`)، aurora gradients، glass tokens، توهّج نيون
- [x] إضافة خطوط `Tajawal` + `IBM Plex Sans Arabic` عبر `<link>` في `src/routes/__root.tsx`
- [x] تثبيت `framer-motion@12`
- [x] Utilities جديدة: `aurora-bg`, `glass-fut`, `btn-magnetic`, `input-glow`, `neon-glow-hover`, `text-neon`, `skeleton-neon`, `pulse-neon`, `grid-overlay`
- [x] مكوّن `PageTransition` — `src/components/motion/PageTransition.tsx`
- [x] مكوّن `StaggerReveal` + `RevealItem` — `src/components/motion/StaggerReveal.tsx`
- [x] `ThemeToggle` (وضع فاتح اختياري) — `src/components/ThemeToggle.tsx`
- [x] احترام `prefers-reduced-motion` عبر `useReducedMotion` + `.reduce-motion` class

**ملفات ذات صلة:**
- `src/styles.css`
- `src/routes/__root.tsx`
- `src/components/ui/*`
- `src/components/MotionToggle.tsx`

---

### المرحلة 2 — الإنترو + الرئيسية + الإعلانات والعروض (أقسام 2، 5)

**الحالة:** ⬜ لم يبدأ

**المهام:**
- [ ] ترقية `IntroOverlay`: جسيمات ضوئية → شعار → انتقال 2.5s، مرة/جلسة، زر تخطّي، اختصار reduced-motion
- [ ] إعادة تصميم `src/routes/index.tsx`: Hero سينمائي + aurora + إحصاءات ثقة + بطاقات أقسام + carousel إعلانات + قسم عروض + طب عن بُعد
- [ ] Migration: جداول `ads`, `offers`, `ad_clicks` + GRANT + RLS (قراءة عامة للفعّال، كتابة للأدمن)
- [ ] Server functions: `src/lib/ads.functions.ts`, `src/lib/offers.functions.ts`
- [ ] مكوّن `AdsCarousel` + `OffersGrid`
- [ ] شاشة أدمن: `src/routes/_authenticated/admin.ads.tsx`, `admin.offers.tsx`
- [ ] تتبّع نقرات الإعلانات (`ad_clicks` insert)

**ملفات ذات صلة:**
- `src/components/IntroOverlay.tsx`
- `src/routes/index.tsx`
- `supabase/migrations/` (جديد)

---

### المرحلة 3 — توليد الصور وربطها بالخدمات (قسم 4)

**الحالة:** ⬜ لم يبدأ

**المهام:**
- [ ] Migration: جدول `service_images (service_id, image_url, alt_ar, alt_en)` + Storage bucket `service-images` + RLS
- [ ] توليد ~15 صورة بأداة `imagegen` (fast) بالبرومت الموحّد
- [ ] رفع الصور إلى Storage + ربطها بالخدمات
- [ ] بطاقة خدمة تعرض الصورة + placeholder زجاجي عند الغياب
- [ ] Server function: `src/lib/service-images.functions.ts`

**البرومت الموحّد:**
```
Futuristic medical illustration, [الخدمة], teal and cyan neon glow,
dark clean background, glassmorphism, soft volumetric light,
premium 3D render, no text, calm and trustworthy, high detail — 16:9
```

**ملفات ذات صلة:**
- `src/routes/services.tsx`
- `src/components/BranchServicesExplorer.tsx`

---

### المرحلة 4 — قسم التجميل والليزر (قسم 6)

**الحالة:** ⬜ لم يبدأ

**المهام:**
- [ ] Migration: `service_categories` (إن لم يوجد)، `devices`, `service_packages`, `package_sessions` + GRANT + RLS
- [ ] Seed migration: خدمات التجميل (ليزر، كربوني، هيدرافيشل، بوتوكس، فيلر، تقشير، نضارة، ميزوثيرابي، PRP، إزالة تصبّغات)
- [ ] شاشة `src/routes/aesthetics.tsx` — تصفح الفئة ببطاقات مصوّرة
- [ ] استمارة تقييم مبدئي (نوع البشرة/الشعر) قبل الحجز
- [ ] ربط بمحرّك الحجز الحالي مع `device_id` و `provider_id`
- [ ] تتبّع الجلسات المتبقية في `package_sessions`
- [ ] Server functions: `src/lib/aesthetics.functions.ts`, `src/lib/packages.functions.ts`

**ملفات ذات صلة:**
- `src/lib/booking-submit.ts`
- `src/lib/slots.functions.ts`
- `src/components/booking/`

---

### المرحلة 5 — ترقية نظام المراجعين + الملف الطبي (أقسام 9، 11)

**الحالة:** ⬜ جزئي — البنية موجودة، نحتاج توسيع

**منجز جزئياً:**
- [x] جداول: `patients`, `patient_visits`, `patient_medications`, `patient_allergies`, `patient_surgeries`, `patient_medical_history`, `patient_immunizations`, `patient_attachments`, `patient_ratings`
- [x] Soft delete للمرضى
- [x] `lab_reports`, `radiology_reports`, `prescriptions`

**المهام المتبقية:**
- [ ] Storage bucket خاص `medical-records` + Signed URLs قصيرة العمر (5 دقائق)
- [ ] Server function `releaseMedicalReport` — الإفراج الصريح من المختصّ
- [ ] إخفاء النتيجة حتى الإفراج (`released_at IS NOT NULL`)
- [ ] تسجيل كل وصول في `security_audit_log` (event: `medical_record.viewed`)
- [ ] شاشة «حقّي في بياناتي» (PDPL): تنزيل نسخة JSON/PDF + إدارة الموافقات
- [ ] بطاقة نتيجة زجاجية + القيم المرجعية + إشعار عند الجديد

**ملفات ذات صلة:**
- `src/lib/patients-mgmt.functions.ts`
- `src/lib/patients.functions.ts`
- `src/routes/_authenticated/patients.index.tsx`

---

### المرحلة 6 — الإشعارات والدفع (قسم 13)

**الحالة:** ⬜ جزئي

**منجز:**
- [x] `notifications` table + realtime bell — `src/components/NotificationBell.tsx`
- [x] `notifications.functions.ts`, `reminder_preferences`, `message-templates.functions.ts`

**المهام المتبقية:**
- [ ] توحيد قنوات الإرسال (in-app + SMS + email) خلف واجهة `sendNotification({channels})`
- [ ] تكامل Moyasar/HyperPay عبر route عام `/api/public/payments/webhook`
- [ ] Server function `initiatePayment` (يحتاج `add_secret` لمفتاح المزوّد)
- [ ] ربط الدفع بالحجز/العرض/الباقة
- [ ] إعادة فتح الفترة تلقائياً عند فشل الدفع

**ملفات ذات صلة:**
- `src/lib/notifications.functions.ts`
- `src/routes/api/` (route جديد للـ webhook)

---

### المرحلة 7 — لوحة الأدمن المطوّرة (قسم 12)

**الحالة:** ⬜ جزئي — لوحات موجودة، نحتاج توحيد وترقية

**منجز:**
- [x] `admin.functions.ts`, `admin-unified-orders.functions.ts`, `admin-order-details.functions.ts`
- [x] `dashboard.functions.ts`
- [x] `patient-stories-admin.functions.ts`, `second-opinion-admin.functions.ts`, `corporate-admin.functions.ts`
- [x] `audit-export.functions.ts`, `reports.functions.ts`
- [x] `rbac.functions.ts` — تغيير الأدوار حصراً لـ `super_admin`

**المهام المتبقية:**
- [ ] Dashboard حيّة ببطاقات مؤشرات متوهّجة (مواعيد اليوم، الإشغال، الإيراد، أكثر الخدمات)
- [ ] رسوم بيانية عبر `recharts`
- [ ] إدارة موحّدة للإعلانات/العروض/الأجهزة/الباقات (مرتبط بالمراحل 2 و4)
- [ ] توفّر بالجملة (bulk availability) للأطباء والأجهزة
- [ ] توسيع تصدير Excel/PDF

**ملفات ذات صلة:**
- `src/routes/_authenticated/` (شاشات الأدمن)
- `src/lib/dashboard.functions.ts`
- `src/lib/admin.functions.ts`

---

### المرحلة 8 — المراجعة الأمنية والإطلاق (قسم 14)

**الحالة:** ⬜ لم يبدأ

**المهام:**
- [ ] تشغيل `security--run_security_scan` وإصلاح كل تحذير
- [ ] اختبار RLS بأدوار مختلفة (patient/receptionist/doctor/admin/super_admin)
- [ ] Rate limiting على OTP وإرسال SMS
- [ ] قائمة ما قبل الإطلاق (checklist): PDPL، نفيس، NCA
- [ ] مراجعة كل `SECURITY DEFINER` functions
- [ ] تأكيد Idempotency لكل migration

---

## 🚫 ما لن نلمسه

- منطق `book_slot` / `_assert_slot_free` / القيد الفريد على `appointments` (منجز ومختبَر تحت الحمل).
- Soft delete للمرضى (منجز).
- ملفات Supabase المولَّدة: `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`.
- ملف البيئة `.env` (متغيرات Supabase).

---

## 📐 اتفاقيات تقنية (تسري على كل المراحل)

- **Design tokens دلالية فقط** في `src/styles.css` — لا ألوان صريحة (`text-white`, `bg-black`, `#hex`) في المكوّنات.
- **Framer Motion** لكل الحركات، مع احترام `prefers-reduced-motion`.
- **كل جدول public جديد** = `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY` (بهذا الترتيب).
- **Server functions المحمية**: تحت `src/lib/*.functions.ts` مع `requireSupabaseAuth`.
- **Edge functions/API routes**: فقط للـ webhooks والدفع تحت `/api/public/*` مع تحقّق توقيع.
- **Audit logs** لكل إجراء إداري حسّاس (`security_audit_log` أو `appointment_audit`).
- **RTL**: كل مكوّن جديد يعمل صحيحاً في `dir="rtl"`.

---

## 📌 الخطوة التالية المقترحة

بدء **المرحلة 1** (الهوية البصرية المستقبلية + ترقية مكوّنات UI الأساسية) والتوقّف لعرض النتيجة قبل المرحلة 2.
