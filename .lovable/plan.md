
# خطة تطوير مجمع باعشن الطبي — نموذج فريق متكامل

## 1) هيكل الفريق (أدوار افتراضية داخل Lovable)

سنعتمد نموذج «Squads» بثلاث فرق متوازية، يقودها Tech Lead واحد (أنت):

| الفريق | المسؤولية | المخرجات |
|---|---|---|
| **Design Squad** | نظام تصميم, Hero, Sliders, بطاقات, أيقونات, تايبوغرافي عربي/إنجليزي | Design tokens في `src/styles.css`, مكوّنات UI موحّدة, Figma-like previews عبر `design--create_directions` |
| **Frontend Squad** | صفحات TanStack Start, i18n, SEO, أداء, إمكانية وصول | صفحات `/`, `/doctors`, `/book`, `/specialties`, `/branches` بمعايير Lighthouse ≥ 90 |
| **Backend/Data Squad** | Supabase (RLS, RPCs, migrations), MCP tools, Edge/Server functions, تحليلات | `list_public_doctors`, `book_appointment` RPC, تدقيقات RLS, لوحات إدارة |

تنسيق أسبوعي عبر `.lovable/plan.md` وتقارير تقدّم في `mcp-status`.

---

## 2) المرجعان

- **udh.sa** — رئيسية مستشفى جامعي: Hero فيديو + شريط خدمات سريع + شبكة تخصصات + أطباء مميّزون + مراكز تميّز + أخبار + مؤشرات ثقة (اعتمادات/أرقام) + Footer غني.
- **eservices.udh.sa/e-services** — بوابة خدمات: بطاقات خدمات (حجز موعد، تقارير مخبرية، أشعة، وصفات، آراء ثانية، شكاوى) مع Wizard حجز متعدد الخطوات، تتبع حالة، تسجيل دخول موحّد (Nafath/OTP).

---

## 3) المرحلة الأولى — نظام تصميم موحّد (أسبوعان)

**Design Squad:**
- استخراج palette من هوية باعشن (Teal/Emerald + Sand) وتحديد `--primary`, `--accent`, `--surface`, `--gradient-hero`, `--shadow-elegant` في `src/styles.css`.
- Typography: عربي `IBM Plex Sans Arabic` أو `Tajawal`, إنجليزي `Inter`. تحميل عبر `<link>` في `__root.tsx`.
- توليد 3 اتجاهات بصرية للرئيسية عبر `design--create_directions` واختيار واحد.
- مكتبة مكوّنات: `HeroVideo`, `ServiceQuickCard`, `SpecialtyTile`, `DoctorCard v2`, `StatCounter`, `TrustBar`, `NewsCard`, `CenterOfExcellenceCard`, `FooterMega`.

**مخرجات:** `src/components/ui-kit/*` + توثيق mini-storybook داخل صفحة `/dev/kit` (dev-only).

---

## 4) المرحلة الثانية — الصفحة الرئيسية على غرار udh.sa (أسبوعان)

**أقسام مطلوبة بالترتيب:**
1. **Hero** — فيديو/سلايدر ملء الشاشة + CTA «احجز موعد» و«الخدمات الإلكترونية».
2. **QuickBar** — 6 أيقونات: حجز, تقارير, أشعة, صيدلية, رعاية منزلية, رأي ثانٍ.
3. **مؤشرات** — StatsBar (سنوات خبرة, أطباء, مرضى, فروع) مع عدّاد متحرك.
4. **التخصصات** — شبكة 12 تخصصًا + رابط «كل التخصصات».
5. **مراكز التميّز** — Carousel لبطاقات كبيرة (قلب, أورام, نساء وولادة, ...).
6. **أطباؤنا** — 4-8 بطاقات + فلترة سريعة.
7. **لماذا باعشن** — 4 قيم (CBAHI, تقنية, رعاية شاملة, رضا المرضى).
8. **أخبار وقصص** — 3 بطاقات من `patient_stories` + `health_articles`.
9. **الاعتمادات** — Marquee لشعارات (CBAHI, JCI مستقبلاً, ...).
10. **الموقع + CTA تواصل**.
11. **Footer Mega** — أعمدة: خدمات, تخصصات, الشركة, تواصل, سوشيال + شهادات.

**Frontend Squad:** إعادة كتابة `src/routes/index.tsx` بتقسيم كل قسم لمكوّن مستقل تحت `src/components/home/`.

**SEO:** JSON-LD `MedicalOrganization` + `WebSite` + `BreadcrumbList` لكل صفحة داخلية.

---

## 5) المرحلة الثالثة — بوابة الخدمات الإلكترونية `/services` (3 أسابيع)

مسار جديد `/services` يحاكي `eservices.udh.sa`:

**بطاقات خدمات (9):**
1. حجز موعد (`/book`)
2. تعديل/إلغاء موعد (`/lookup`)
3. تقارير مخبرية (`/my/lab-reports`)
4. تقارير أشعة (`/my/radiology`)
5. الوصفات الطبية (`/my/prescriptions`)
6. طلب دواء (`/pharmacy`)
7. رأي طبي ثانٍ (`/second-opinion`)
8. رعاية منزلية (`/home-care`)
9. الشكاوى والاقتراحات (`/complaints`)

كل بطاقة: أيقونة + وصف + زر + شارة «يتطلب تسجيل دخول» عند الحاجة.

**تسجيل دخول موحّد:** إبقاء Email/Google + إضافة OTP عبر الهاتف (Supabase Phone Auth) — مستقبلاً Nafath.

---

## 6) المرحلة الرابعة — تطوير نظام الحجز (أسبوعان)

الأساس موجود في `/book` بـ 9 خطوات. التحسينات:

- **Deep-links** `?service`, `?doctor`, `?specialty`, `?branch` — validateSearch + قفز تلقائي.
- **Progress سحابي**: حفظ في `sessionStorage` + استرجاع من رابط `resume`.
- **Slot lock مؤقّت** (2 دقيقة) عبر RPC `reserve_slot` لمنع التعارض.
- **تأكيد OTP** قبل الإنشاء للمرضى غير المسجّلين.
- **شاشة نجاح**: QR + إضافة للتقويم (`.ics`) + WhatsApp + PDF + رابط تتبع.
- **صفحة تتبع** `/track/$reference` تعرض حالة الموعد وتسمح بالتعديل/الإلغاء.

---

## 7) المرحلة الخامسة — لوحات إدارية وتحليلات (أسبوع)

- `/admin/analytics` — KPIs: حجوزات/يوم, معدل الإلغاء, زمن الانتظار, رضا المرضى.
- `/admin/doctors-management` — رفع صور فعلية (Supabase Storage) + جدولة إجازات.
- `/admin/content` — إدارة أخبار وقصص ومقالات صحية.
- `/mcp-status` (موجود) — يُوسَّع لعرض مقاييس أداء الأدوات.

---

## 8) المرحلة السادسة — الجودة والإطلاق (أسبوع)

- **Playwright E2E** لكل مسار خدمة (11 مسار).
- **RLS tests** لكل جدول جديد.
- **Lighthouse** ≥ 90 على الرئيسية والحجز موبايل/سطح مكتب.
- **Accessibility**: WCAG 2.1 AA — تباين, تنقّل لوحة مفاتيح, ARIA.
- **i18n**: مراجعة كل السلاسل عربي/إنجليزي.
- **Sitemap** + `robots.txt` + hreflang.

---

## 9) الجدول الزمني الإجمالي

```text
الأسبوع 1-2:  نظام التصميم + اختيار الاتجاه البصري
الأسبوع 3-4:  الرئيسية الجديدة
الأسبوع 5-7:  بوابة /services + Auth محسّن
الأسبوع 8-9:  ترقية Wizard الحجز + تتبع
الأسبوع 10:   لوحات الإدارة والتحليلات
الأسبوع 11:   QA + Lighthouse + إطلاق
```

---

## 10) تفاصيل تقنية (للمطوّرين)

- **Stack**: TanStack Start + React 19 + Tailwind v4 + Supabase (Lovable Cloud) + Cloudflare Workers.
- **مكوّنات Home** تُقسم إلى: `HeroVideo.tsx`, `ServicesGrid.tsx`, `SpecialtiesGrid.tsx`, `CentersCarousel.tsx`, `DoctorsStrip.tsx`, `NewsStrip.tsx`, `FooterMega.tsx`.
- **RPCs جديدة**: `reserve_slot(_doctor_id, _date, _time)`, `confirm_slot(_reservation_id)`, `service_metrics()`.
- **جداول جديدة**: `slot_reservations` (TTL 2min via trigger), `service_requests` موحّد.
- **MCP**: إضافة `list_services`, `track_appointment`, `request_lab_report`.
- **CI**: توسيع `.github/workflows/ci.yml` بمسارات Playwright الجديدة.

---

## 11) قرارات معلّقة (تحتاج موافقتك)

1. **الاتجاه البصري**: هل أُطلق `design--create_directions` بثلاثة خيارات قبل البدء؟
2. **الخط**: `Tajawal` أم `IBM Plex Sans Arabic`؟
3. **OTP**: تفعيل Twilio عبر Supabase Phone Auth الآن أم مرحلة لاحقة؟
4. **صور الأطباء**: بدء رفع فعلي أم إبقاء Initials حتى تجهيز التصوير؟
5. **مراكز التميّز**: نفس القائمة الحالية أم توسعتها لتشابه udh.sa (قلب, أورام, أعصاب, ...)؟

---

## ماذا أنفّذ بعد موافقتك؟

اقتراحي بدء **المرحلة 1 + 2** فورًا:
1. إطلاق 3 اتجاهات تصميم للرئيسية.
2. تحديث نظام الألوان والخطوط.
3. إعادة بناء الرئيسية قسمًا قسمًا.

أخبرني بالقرارات في الفقرة (11) أو قل «ابدأ» لأعتمد الافتراضات وأبدأ فورًا.
