/**
 * لوحة الطلبات الموحّدة (Admin) — Bashen Medical.
 *
 * تجمع لأصحاب الأدوار (admin / reception / super_admin) أحدث الطلبات عبر
 * كل جداول الخدمات (مواعيد، بلاغات، أدوية، زيارات منزلية، استشارات،
 * فواتير، مختبر، أشعة) مع فلاتر: النوع، الحالة الخام، بحث نصي، والحد.
 *
 * ملاحظات:
 *   - المرحلة الأولى: بدون Server-side pagination كاملة؛ نقص عند الحد.
 *   - الحالة الموحّدة تُشتق في الواجهة عبر toUnifiedStatus.
 *   - البلاغات والمواعيد تدعم البحث بالاسم/الهاتف/المرجع.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { OrderTableKind } from "@/lib/unified-status";

type Role = "admin" | "reception" | "pharmacy" | "super_admin";

async function getRoles(supabase: any, userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as Role);
}
function ensureAdminOrReception(roles: Role[]) {
  if (roles.includes("super_admin")) return;
  if (!roles.some((r) => r === "admin" || r === "reception")) {
    throw new Error("ليست لديك الصلاحية لعرض لوحة الطلبات الموحّدة.");
  }
}

export type UnifiedAdminOrder = {
  kind: OrderTableKind;
  id: string;
  reference: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  status: string;
  created_at: string;
  meta: string | null;
};

const KINDS: readonly OrderTableKind[] = [
  "appointment",
  "complaint",
  "medicine_order",
  "home_care",
  "second_opinion",
  "invoice",
  "lab_report",
  "radiology_report",
] as const;

export const listAllUnifiedOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kinds: z
          .array(
            z.enum([
              "appointment",
              "complaint",
              "medicine_order",
              "home_care",
              "second_opinion",
              "invoice",
              "lab_report",
              "radiology_report",
            ]),
          )
          .optional(),
        search: z.string().trim().max(100).optional(),
        limitPerKind: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    ensureAdminOrReception(roles);

    const wanted = new Set<OrderTableKind>(data.kinds && data.kinds.length ? data.kinds : KINDS);
    const q = (data.search ?? "").trim();
    const like = q ? `%${q}%` : null;
    const lim = data.limitPerKind;

    const supabase = context.supabase;

    const wants = (k: OrderTableKind) => wanted.has(k);

    const appts = wants("appointment")
      ? (async () => {
          let sel = supabase
            .from("appointments")
            .select(
              "id, patient_name, patient_phone, status, created_at, appointment_date, appointment_time",
            )
            .order("created_at", { ascending: false })
            .limit(lim);
          if (like)
            sel = sel.or(`patient_name.ilike.${like},patient_phone.ilike.${like}`);
          return sel;
        })()
      : Promise.resolve({ data: [], error: null });

    const complaints = wants("complaint")
      ? (async () => {
          let sel = supabase
            .from("complaints")
            .select("id, reference, patient_name, patient_phone, status, created_at, message")
            .order("created_at", { ascending: false })
            .limit(lim);
          if (like)
            sel = sel.or(
              `reference.ilike.${like},patient_name.ilike.${like},patient_phone.ilike.${like}`,
            );
          return sel;
        })()
      : Promise.resolve({ data: [], error: null });

    const meds = wants("medicine_order")
      ? (async () => {
          let sel = supabase
            .from("medicine_orders")
            .select("id, patient_name, patient_phone, status, created_at, delivery_type")
            .order("created_at", { ascending: false })
            .limit(lim);
          if (like)
            sel = sel.or(`patient_name.ilike.${like},patient_phone.ilike.${like}`);
          return sel;
        })()
      : Promise.resolve({ data: [], error: null });

    const homeCare = wants("home_care")
      ? (async () => {
          let sel = supabase
            .from("home_care_requests")
            .select("id, patient_name, patient_phone, status, created_at, service_type")
            .order("created_at", { ascending: false })
            .limit(lim);
          if (like)
            sel = sel.or(`patient_name.ilike.${like},patient_phone.ilike.${like}`);
          return sel;
        })()
      : Promise.resolve({ data: [], error: null });

    const secondOp = wants("second_opinion")
      ? (async () => {
          let sel = supabase
            .from("second_opinion_requests")
            .select("id, patient_name, phone, status, created_at, specialty")
            .order("created_at", { ascending: false })
            .limit(lim);
          if (like) sel = sel.or(`patient_name.ilike.${like},phone.ilike.${like}`);
          return sel;
        })()
      : Promise.resolve({ data: [], error: null });

    const invoices = wants("invoice")
      ? supabase
          .from("invoices")
          .select("id, invoice_number, status, created_at, patient_id")
          .order("created_at", { ascending: false })
          .limit(lim)
      : Promise.resolve({ data: [], error: null });

    const labs = wants("lab_report")
      ? supabase
          .from("lab_reports")
          .select("id, title, test_type, status, created_at, patient_id")
          .order("created_at", { ascending: false })
          .limit(lim)
      : Promise.resolve({ data: [], error: null });

    const rads = wants("radiology_report")
      ? supabase
          .from("radiology_reports")
          .select("id, status, created_at, patient_id")
          .order("created_at", { ascending: false })
          .limit(lim)
      : Promise.resolve({ data: [], error: null });

    const [aRes, cRes, mRes, hRes, sRes, iRes, lRes, rRes] = await Promise.all([
      appts,
      complaints,
      meds,
      homeCare,
      secondOp,
      invoices,
      labs,
      rads,
    ]);

    // إثراء الفاتورة/المختبر/الأشعة باسم وهاتف المريض
    const patientIds = new Set<string>();
    for (const r of (iRes.data ?? []) as any[]) if (r.patient_id) patientIds.add(r.patient_id);
    for (const r of (lRes.data ?? []) as any[]) if (r.patient_id) patientIds.add(r.patient_id);
    for (const r of (rRes.data ?? []) as any[]) if (r.patient_id) patientIds.add(r.patient_id);
    let pmap = new Map<string, { name: string | null; phone: string | null }>();
    if (patientIds.size) {
      const { data: pats } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .in("id", Array.from(patientIds));
      for (const p of (pats ?? []) as any[])
        pmap.set(p.id, { name: p.full_name ?? null, phone: p.phone ?? null });
    }

    const out: UnifiedAdminOrder[] = [];

    for (const r of (aRes.data ?? []) as any[]) {
      out.push({
        kind: "appointment",
        id: r.id,
        reference: null,
        patient_name: r.patient_name ?? null,
        patient_phone: r.patient_phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta:
          r.appointment_date
            ? `${r.appointment_date}${r.appointment_time ? " " + String(r.appointment_time).slice(0, 5) : ""}`
            : null,
      });
    }
    for (const r of (cRes.data ?? []) as any[]) {
      out.push({
        kind: "complaint",
        id: r.id,
        reference: r.reference ?? null,
        patient_name: r.patient_name ?? null,
        patient_phone: r.patient_phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: typeof r.message === "string" ? r.message.slice(0, 60) : null,
      });
    }
    for (const r of (mRes.data ?? []) as any[]) {
      out.push({
        kind: "medicine_order",
        id: r.id,
        reference: null,
        patient_name: r.patient_name ?? null,
        patient_phone: r.patient_phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: r.delivery_type ?? null,
      });
    }
    for (const r of (hRes.data ?? []) as any[]) {
      out.push({
        kind: "home_care",
        id: r.id,
        reference: null,
        patient_name: r.patient_name ?? null,
        patient_phone: r.patient_phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: r.service_type ?? null,
      });
    }
    for (const r of (sRes.data ?? []) as any[]) {
      out.push({
        kind: "second_opinion",
        id: r.id,
        reference: null,
        patient_name: r.patient_name ?? null,
        patient_phone: r.phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: r.specialty ?? null,
      });
    }
    for (const r of (iRes.data ?? []) as any[]) {
      const p = r.patient_id ? pmap.get(r.patient_id) : null;
      out.push({
        kind: "invoice",
        id: r.id,
        reference: r.invoice_number ?? null,
        patient_name: p?.name ?? null,
        patient_phone: p?.phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: null,
      });
    }
    for (const r of (lRes.data ?? []) as any[]) {
      const p = r.patient_id ? pmap.get(r.patient_id) : null;
      out.push({
        kind: "lab_report",
        id: r.id,
        reference: null,
        patient_name: p?.name ?? null,
        patient_phone: p?.phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: r.title ?? r.test_type ?? null,
      });
    }
    for (const r of (rRes.data ?? []) as any[]) {
      const p = r.patient_id ? pmap.get(r.patient_id) : null;
      out.push({
        kind: "radiology_report",
        id: r.id,
        reference: null,
        patient_name: p?.name ?? null,
        patient_phone: p?.phone ?? null,
        status: r.status,
        created_at: r.created_at,
        meta: null,
      });
    }

    // فلترة بحث اسم/رقم على الجداول المُثراة (invoices/labs/rads) أيضًا
    const filtered = like
      ? out.filter((r) => {
          const kk = r.kind;
          if (kk === "invoice" || kk === "lab_report" || kk === "radiology_report") {
            const hay = `${r.patient_name ?? ""} ${r.patient_phone ?? ""} ${r.reference ?? ""}`;
            return hay.toLowerCase().includes(q.toLowerCase());
          }
          return true;
        })
      : out;

    filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return filtered;
  });
