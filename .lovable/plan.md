# خطة بناء بوابة خدمات المرضى (ne.md)

## الوضع الحالي (ما هو موجود فعلاً)

المشروع فيه بنية بوابة كاملة تقريباً تحت `src/routes/_authenticated/portal.*`:
- `portal.index` (لوحة المريض)، `portal.book`، `portal.doctors`
- `portal.laboratory`، `portal.radiology`، `portal.records`، `portal.prescriptions`
- `portal.invoices`، `portal.payments`، `portal.insurance`، `portal.notifications`
- `portal.profile`، `portal.settings`

و`src/lib/portal/` فيه: `booking / lab / portal / prescriptions / radiology / records`.
كما توجد جداول: appointments, doctors, branches, lab_results, radiology_reports, prescriptions, RBAC, audit_logs، مع RLS وحارس `_authenticated/route.tsx`.

لذلك الخطة **تتمّم الفجوات** بدل إعادة البناء من الصفر.

---

## المراحل

### م0 — مراجعة الأساس (يوم واحد، بدون كود)
- تدقيق تطابق البوابة الحالية مع مواصفات `ne.md`: الألوان (#00D9C0/#0A1A2F/#EAF7F5)، الخط (Tajawal)، `rounded-2xl`، حالات (تحميل/فارغ/خطأ) في كل شاشة بوابة.
- تقرير موجز بالفجوات لكل شاشة قبل التنفيذ.

### م1 — الهوية: دخول بالجوال + OTP
- إضافة تدفّق تسجيل دخول برقم الجوال (E.164) + OTP عبر Supabase Auth `signInWithOtp({ phone })`.
- Edge Function اختيارية لتخصيص مزوّد SMS (Unifonic) عبر Auth Hook.
- تحديث `src/routes/auth.tsx` لدعم تبويبين: البريد الحالي + جوال/OTP.
- ملء `profiles.phone` و`preferred_lang` بعد أول دخول.

### م2 — محرّك الحجز الذرّي (الأهم)
- جدول `availability_slots(doctor_id, clinic_id, slot_date, start_time, end_time, status)` + فهرس فريد يمنع التكرار.
- RPC `book_slot(slot_id, appointment_payload)` بمعاملة `FOR UPDATE` تقفل الـslot وتحوّله إلى `booked` وتُنشئ الموعد ذرّياً.
- Realtime على `availability_slots` لعرض التغيّرات فوراً في `portal.book`.
- تحسين تدفّق الحجز الحالي ليمرّ عبر RPC بدل insert مباشر.

### م3 — إدارة المواعيد
- «مواعيدي» في `portal.index` بتبويبين (قادمة/سابقة) + إلغاء + إعادة جدولة (تُعيد فتح الـslot السابق داخل RPC آخر).
- تحسين لوحة الاستقبال الحالية (`appointments-queue`) بتقويم يومي + بحث بالمريض.

### م4 — النتائج والتقارير (حسّاسة)
- Bucket خاص `medical-files` (غير عام) + سياسات Storage.
- عمود `released bool` و`released_by` في `lab_results` و`radiology_reports` (موجود جزئياً — تحقّق).
- Signed URL قصير العمر (5 دقائق) عبر server function عند طلب التنزيل.
- تسجيل كل وصول في `audit_logs`.
- واجهات رفع للفنيين (`lab_tech`, `radiologist`) خلف RBAC.

### م5 — الطب عن بُعد + زيارة منزلية + دواء
- `telemedicine_sessions` مربوطة بـ`appointment_id`، تكامل Daily.co عبر Edge Function تُنشئ room + tokens.
- زر «انضمام» يظهر ±15 دقيقة من موعد الجلسة.
- تفعيل `home-care` الحالي كتدفّق كامل + تتبّع حالة.
- طلبات الدواء `medication_orders` + شاشة صيدلي.

### م6 — الدفع والإشعارات
- بوابة Moyasar عبر Edge Function `/api/public/hooks/moyasar-webhook` بتحقّق توقيع.
- توحيد `notifications` (داخل التطبيق + SMS + بريد) عبر channel selector.

### م7 — لوحة الإدارة والإطلاق
- إحصاءات (موجودة جزئياً في `command-center`) — إضافة KPIs: إشغال، أكثر الأطباء طلباً.
- شاشات إدارة `availability_slots` للأطباء.
- **مراجعة أمان شاملة**: تشغيل `security--run_security_scan`، فحص RLS لكل جدول جديد، حذف أي بيانات طبية وهمية.

---

## قواعد صارمة على كل مرحلة
- Migration idempotent (`IF NOT EXISTS` / `ON CONFLICT`) + GRANT صريح.
- RLS مفعّلة على كل جدول جديد، policies مقيّدة بـ`auth.uid()` أو `has_role(...)`.
- لا `console.log` لبيانات طبية، لا معرّفات مرضى في URL params.
- RTL + i18n (ar/en) لكل شاشة، مع الحالات الأربع (loading/empty/error/success).
- بعد كل مرحلة: توقّف + إثبات بلقطات + اختبار RLS متقاطع (مريض أ لا يرى بيانات ب).

---

## البدء
حسب توجيه الملف: أنفّذ **م0 + م1** فقط، ثم أقف وأعرض النتيجة قبل محرّك الحجز.

هل أبدأ بـ م0 (تقرير الفجوات) ثم م1 مباشرة؟