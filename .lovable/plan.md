# وحدة Pharmacy (الصيدلية) داخل لوحة الإدارة

إضافة وحدة صيدلية مستقلة في `/_authenticated/pharmacy` بثلاثة تبويبات:

## التبويبات

1. **المخزون + تنبيه انتهاء الصلاحية (Inventory)**
   - جدول الأدوية مع: الاسم، الرمز/الباركود، الشكل الصيدلاني، الوحدة، الكمية الحالية، الحد الأدنى، الفرع.
   - شارات تحذير: **منتهي**، **قريب الانتهاء** (≤ 30 يوم — قابل للتخصيص لكل فرع لاحقًا)، **مخزون منخفض** (كمية ≤ min_stock).
   - فلترة: فرع، حالة (الكل / قريب الانتهاء / منتهي / منخفض / نافد).
   - CRUD كامل عبر Dialog.

2. **حركة المخزون (Stock Movements)**
   - سجل يعرض كل حركة: نوع (استلام/صرف/تعديل/إتلاف/تحويل)، الكمية (+/-)، السبب، المرجع، المستخدم، التاريخ.
   - فلترة بالفرع والصنف والفترة.
   - زر "حركة جديدة" يفتح Dialog يختار الصنف + النوع + الكمية + الملاحظات، ويطبّق التغيير تلقائيًا على `inventory_items.quantity` عبر Trigger.

3. **موافقات الوصفات (Prescription Approvals)**
   - قائمة وصفات بحالة `pending_pharmacy` تحتاج مراجعة الصيدلي.
   - بطاقات تعرض: المريض، الطبيب، الأدوية، تاريخ الإصدار.
   - أزرار: **موافقة** (يتحول إلى `approved` + خصم من المخزون تلقائيًا لكل دواء)، **رفض** (مع سبب)، **طلب توضيح**.
   - تحديث كل 20 ثانية.

في سايدبار الـ Command Center: تفعيل رابط "الصيدلية" (بدل Coming Soon).

## الجداول الجديدة

- `inventory_items`: `id, branch_id → branches, name_ar, name_en, sku, barcode, form (tab/syrup/inj/…), unit, quantity int, min_stock int, expiry_date date NULL, price numeric NULL, notes, is_active, created_at, updated_at`. فهرس على `(branch_id, expiry_date)` و `(branch_id, name_ar)`.
- `stock_movements`: `id, item_id → inventory_items, branch_id, movement_type ('in'|'out'|'adjust'|'waste'|'transfer'), quantity_delta int (يقبل السالب), reason, reference (nullable — رقم وصفة/توريد)، created_by, created_at`. فهرس على `(item_id, created_at)`.
- تعديل `prescriptions` (موجود): إضافة أعمدة `pharmacy_status ('pending'|'approved'|'rejected'|'needs_info')`, `reviewed_by`, `reviewed_at`, `review_notes` (فقط إذا لم تكن موجودة).

Trigger على `stock_movements` (AFTER INSERT): يعدل `inventory_items.quantity` بمقدار `quantity_delta`.

### RLS + GRANTs
- Admin/super_admin: كامل.
- pharmacy: قراءة + كتابة على كل الجداول الثلاثة (إضافة أدوية، تسجيل حركات، الموافقة على الوصفات).
- reception: قراءة فقط للمخزون والحركات.

## Server functions

ملف `src/lib/pharmacy.functions.ts`:
- **Inventory:** `listInventoryItems({ branchId?, filter? })`, `upsertInventoryItem(data)`, `deleteInventoryItem(id)`.
- **Movements:** `listStockMovements({ branchId?, itemId?, from?, to? })`, `createStockMovement(data)`.
- **Prescriptions:** `listPendingPrescriptions({ branchId? })`, `reviewPrescription({ id, decision, notes? })` — عند الموافقة يُنشئ حركات صرف تلقائيًا لكل عنصر مربوط بمخزون.

كل الدوال محمية بـ `requireSupabaseAuth` وتعتمد على RLS للتحقق من الدور.

## الواجهة

- **Tabs** من shadcn + جداول RTL مع بحث فوري.
- شارات ملوّنة للحالة (منتهي = أحمر، قريب = كهرماني، منخفض = برتقالي).
- Dialog موحّد للإضافة/التعديل مع validations.
- عرض متجاوب: بطاقات على الجوال، جداول على الشاشة الكبيرة.

## ملاحظات تقنية

- نستخدم `useServerFn` + `useQuery` (`refetchInterval: 20000` في تبويب الوصفات فقط).
- الحسابات (منتهي/قريب/منخفض) تتم على الخادم لضمان الاتساق، مع كشفها كأعمدة محسوبة في الرد.
- لا حاجة لتغيير `medicine_orders` (طلبات المرضى) — هذه وحدة مخزون داخلية منفصلة.
- الأسعار والتكاليف اختيارية الآن؛ لا تكامل فوترة في هذه المرحلة.

هل أبدأ؟ إذا رغبت بتضييق نطاق التبويب الثالث (مثلاً قراءة الوصفات فقط دون خصم تلقائي من المخزون) أخبرني قبل التنفيذ.
