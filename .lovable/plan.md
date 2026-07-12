
# لوحة الإدارة الفاخرة — مجمع باعشن الطبي

المواصفات التي طلبتها ضخمة (24 قسم جانبي + 12 KPI + مركز ذكاء اصطناعي + وحدات صيدلية/مخبر/أشعة/مالية/موارد بشرية…). المشروع يحوي فعلاً ~30 صفحة إدارية منفصلة (`admin.tsx` وحده 4381 سطراً)، لذلك الأفضل أن نضيف **قشرة (Shell) موحّدة جديدة** على شكل *Command Center* دون هدم الصفحات القائمة، ثم نربطها تدريجياً.

## المخرجات (مرحلة أولى — هذا الطلب)

سأنجز في هذه الدفعة:

1. **مسار جديد** `/_authenticated/command-center` (لا نلمس `/admin` القائم).
2. **قشرة تصميم مؤسسية** بلون خلفية داكن (Dark Navy `#0B1220`) + زجاجية Glassmorphism + بطاقات بحواف 24px + ظلال ناعمة، مع دعم Light/Dark و RTL.
3. **شريط جانبي قابل للطي** يحوي 24 عنصراً بأيقونات Lucide، مع مؤشر نشط متحرك (Framer Motion) وشعار المجمع.
4. **شريط علوي** (بحث عام + تنبيهات + بروفايل مدير + Command Palette عبر ⌘K).
5. **12 بطاقة KPI** بمخطط شرارة (sparkline) صغير، تغيّر النسبة، أيقونة متحركة، وتدرّج لوني.
6. **مركز الذكاء الاصطناعي**: بطاقة كبيرة تحوي مخطط تدفق المرضى (Recharts) + قائمة توصيات AI + توقع الإيرادات.
7. **إدارة المواعيد**: تقويم أسبوعي بصفوف الأطباء + شارات "Video Consultation / Booked" (عرض فقط في هذه المرحلة، بدون سحب/إفلات).
8. **بطاقات الوحدات الأربع في الأسفل**: Laboratory / Radiology / Pharmacy / Billing (ملخّصات فقط).
9. **مساعد AI عائم** في الزاوية (زر يفتح لوحة صغيرة، يعيد استخدام منطق `ChatbotBubble` مع تصميم Command Center).
10. توكينات ألوان جديدة في `src/styles.css` مطابقة تماماً لباليتّتك:
    - Primary Blue `#0F6CBD`
    - Medical Cyan `#1CC8EE`
    - Dark Navy `#102A43`
    - Success `#22C55E` / Warning `#F59E0B` / Danger `#EF4444`
    - `--gradient-primary`, `--gradient-cyan`, `--shadow-glass`, `--surface-glass`

**البيانات في هذه المرحلة**: مزيج من بيانات حقيقية (المرضى/المواعيد/الأطباء عبر server functions موجودة أصلاً) + بيانات mock للـ KPIs غير المتوفرة بعد (Emergency, Occupancy, Satisfaction…) مع تعليم واضح `MOCK` حتى نربطها لاحقاً.

## المراحل التالية (لن تُنفّذ الآن — تحتاج تأكيدك بعد رؤية المرحلة الأولى)

- **مرحلة 2**: صفحات فرعية حقيقية لكل قسم لم يُغطَّ (Nurses / Pharmacy / Inventory / HR / Payroll / Insurance) — كل واحدة تحتاج جدول قاعدة بيانات + RLS + CRUD.
- **مرحلة 3**: Drag-and-drop للتقويم، عارض صور DICOM للأشعة، ماسح باركود للصيدلية.
- **مرحلة 4**: تكامل مدفوعات (Apple Pay/Google Pay) عبر Stripe.
- **مرحلة 5**: RBAC كامل بأدوار (admin / doctor / nurse / receptionist / accountant / lab_tech / radiologist / pharmacist) + Audit Log موسّع.

## الملفات التي ستُنشأ/تُعدَّل

```text
src/styles.css                                    ← إضافة توكينات Command Center
src/routes/_authenticated/command-center.tsx      ← الصفحة الرئيسية الجديدة
src/components/command-center/
  Shell.tsx                                       ← Sidebar + Topbar + Layout
  Sidebar.tsx                                     ← الشريط الجانبي (24 عنصر)
  Topbar.tsx                                      ← بحث + تنبيهات + بروفايل
  KpiCard.tsx                                     ← بطاقة KPI مع sparkline
  KpiGrid.tsx                                     ← شبكة الـ 12 بطاقة
  AiCommandCenter.tsx                             ← مركز الذكاء الاصطناعي
  AppointmentBoard.tsx                            ← جدول مواعيد الأسبوع
  ModuleSummaryCards.tsx                          ← Lab/Radiology/Pharmacy/Billing
  CommandPalette.tsx                              ← ⌘K
  FloatingAiAssistant.tsx                         ← المساعد العائم
src/lib/command-center/kpis.functions.ts          ← server fn يجمع الأرقام من جداول موجودة
```

## ملاحظات تقنية

- **بدون Next.js**: البقاء على TanStack Start / React 19 / Tailwind v4 / shadcn المثبت. Magic UI و Aceternity ليست ضمن الحزم؛ سأحاكي تأثيراتهم (Shine border, animated gradient, glass card) بـ Framer Motion + Tailwind بدل تثبيت مكتبات ثقيلة إضافية.
- **ApexCharts** غير مثبت والمشروع يستخدم Recharts فعلاً؛ سأستمر بـ Recharts للسرعة والاتساق. إن أصررت على ApexCharts أخبرني.
- **RTL**: كل المكوّنات مبنية بـ `dir="rtl"` + `start`/`end` بدل `left`/`right`.
- **الأداء**: كل بطاقة KPI تُحمّل بيانتها عبر `useQuery` منفصل حتى لا تنتظر الصفحة الأبطأ.
- **الأمان**: `/_authenticated/command-center` محمي تلقائياً بطبقة الـ auth. سنضيف فحص دور `admin` عبر `has_role` داخل server function الـ KPIs قبل إرجاع أي رقم إيرادات.

هل أبدأ بتنفيذ المرحلة الأولى كما وُصف، أم تريد تعديلاً (مثل: تغيير قائمة الـ KPI، أو اقتصار الشريط الجانبي على أقسام أقل، أو استبدال المخططات)؟
