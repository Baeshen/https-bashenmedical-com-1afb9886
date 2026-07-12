# وحدة Nurses (التمريض) داخل لوحة الإدارة

إضافة وحدة كاملة للتمريض تشمل:
- سجل الممرضين/الممرضات (ربطًا بالفروع).
- **جداول الورديات** (Shifts) لعرض ومن يعمل متى.
- **استدعاءات المرضى** (Nurse Call Queue) لإدارة الطلبات القادمة من غرف المرضى.

## الصفحات

المسار الرئيسي: `/_authenticated/nurses` مع 3 تبويبات RTL:

1. **الطاقم (Nurses):** جدول بأسماء الممرضين، الفرع، القسم، الحالة (متاح/إجازة)، مع نموذج إضافة/تعديل/حذف (Admin فقط).
2. **الورديات (Shifts):** عرض أسبوعي (Grid: 7 أيام × Nurses) مع لون لكل نوع وردية (صباحية/مسائية/ليلية). فلترة بالفرع والتاريخ. إضافة/حذف وردية عبر Dialog.
3. **استدعاءات المرضى (Calls):** قائمة الاستدعاءات النشطة بأولوية (عادي/عاجل/حرج)، مع أزرار: قبول → قيد المعالجة → مكتمل / ملغى. تحديث تلقائي كل 15 ثانية.

كما تُضاف بطاقة "Nurses" في `command-center` سايدبار كرابط نشط.

## الجداول الجديدة

- `nurses`: `id, full_name, phone, email, branch_id → branches, department, employee_no, status ('active'|'on_leave'|'inactive'), notes, created_at, updated_at`.
- `nurse_shifts`: `id, nurse_id → nurses, branch_id, shift_date (date), shift_type ('morning'|'evening'|'night'), start_time, end_time, notes, created_by, created_at, updated_at`. فهارس على `(branch_id, shift_date)` و `(nurse_id, shift_date)`.
- `nurse_calls`: `id, branch_id, patient_id → patients (nullable), room_no, reason, priority ('normal'|'urgent'|'critical'), status ('pending'|'in_progress'|'completed'|'cancelled'), assigned_nurse_id → nurses (nullable), called_at, accepted_at, completed_at, notes, created_at, updated_at`. فهرس على `(status, priority, called_at)`.

RLS + GRANTs (Admin/Staff قراءة+كتابة عبر `has_role`؛ لا وصول لـ anon):
- Admin: كل شيء.
- staff/nurse role: قراءة الطاقم/الورديات؛ كتابة `nurse_calls` (تحديث الحالة والإسناد).

## Server functions

ملف `src/lib/nurses.functions.ts` مع `requireSupabaseAuth` + فحص الدور:
- `listNurses({ branchId? })`, `upsertNurse(data)`, `deleteNurse(id)`.
- `listShifts({ branchId, fromDate, toDate })`, `upsertShift(data)`, `deleteShift(id)`.
- `listCalls({ branchId?, status? })`, `createCall(data)`, `updateCallStatus({ id, status, assigned_nurse_id? })`.

## الواجهة

- استخدام `Tabs`, `Dialog`, `Select`, `Badge` من shadcn.
- عرض الوردية: Grid CSS مع بطاقة صغيرة لكل وردية (لون حسب النوع).
- الاستدعاءات: بطاقات تحمل شارة أولوية ملوّنة + مؤقت "منذ كم دقيقة" + أزرار حالة.
- التحديث التلقائي عبر `useQuery` + `refetchInterval: 15000` على الاستدعاءات النشطة.

## تفاصيل تقنية

- المسارات: `src/routes/_authenticated/nurses.tsx` (تبويبات في مكوّن واحد لتبسيط الحالة والفلاتر).
- نمط التحميل: `context.queryClient.ensureQueryData` في loader + `useSuspenseQuery` للطاقم؛ `useQuery` مع polling للاستدعاءات.
- ربط في `command-center` كعنصر Sidebar نشط بدل "Coming Soon".
- لا Realtime حاليًا (Polling كافٍ)؛ يمكن ترقيته لاحقًا.
- لا يُدمج مع `doctor_leaves`؛ الإجازات مستقبلًا.

هل أبدأ التنفيذ بهذا النطاق أو تفضّل تعديل أي جزء (مثلاً إخفاء المرضى/الغرف، أو تبسيط الورديات لقائمة بدل شبكة أسبوعية)؟
