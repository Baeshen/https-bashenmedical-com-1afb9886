import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * M2 — Atomic booking engine.
 * - listAvailableSlots: public read (available slots for a doctor/date range).
 * - bookSlot: public RPC call, atomically reserves the slot + creates appointment.
 * - releaseSlot: staff only, reopens a slot when an appointment is cancelled.
 * - generateSlots: staff only, bulk-creates slots for a doctor on a given day.
 */

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Public: list available slots
// ---------------------------------------------------------------------------
const listSchema = z.object({
  doctorId: z.string().uuid(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export const listAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => listSchema.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverPublicClient();
    let q = sb
      .from("availability_slots")
      .select("id, doctor_id, branch_id, slot_date, start_time, end_time, status")
      .eq("doctor_id", data.doctorId)
      .eq("status", "available")
      .gte("slot_date", data.fromDate)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(500);

    if (data.toDate) q = q.lte("slot_date", data.toDate);
    else q = q.lte("slot_date", data.fromDate);
    if (data.branchId) q = q.eq("branch_id", data.branchId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { slots: rows ?? [] };
  });

// ---------------------------------------------------------------------------
// Public: book a slot (atomic via RPC)
// ---------------------------------------------------------------------------
const bookSchema = z.object({
  slotId: z.string().uuid(),
  patientName: z.string().trim().min(2).max(120),
  patientPhone: z.string().trim().min(6).max(32),
  patientEmail: z.string().email().max(200).optional().nullable(),
  nationalId: z.string().trim().max(32).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  patientId: z.string().uuid().optional().nullable(),
});

const RPC_ERROR_MAP: Record<string, string> = {
  slot_required: "لم يتم تحديد الفترة.",
  patient_name_required: "اسم المريض مطلوب.",
  patient_phone_required: "رقم الجوال مطلوب.",
  slot_not_found: "لم يتم العثور على هذه الفترة.",
  slot_unavailable: "هذه الفترة لم تعد متاحة، الرجاء اختيار فترة أخرى.",
  slot_in_past: "لا يمكن الحجز في وقت مضى.",
};

function friendlyRpcError(msg: string | undefined): string {
  if (!msg) return "تعذّر إتمام الحجز.";
  for (const key of Object.keys(RPC_ERROR_MAP)) {
    if (msg.includes(key)) return RPC_ERROR_MAP[key];
  }
  return "تعذّر إتمام الحجز. حاول مرة أخرى.";
}

export const bookSlot = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => bookSchema.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverPublicClient();
    const { data: apptId, error } = await sb.rpc("book_slot", {
      p_slot_id: data.slotId,
      p_patient_name: data.patientName,
      p_patient_phone: data.patientPhone,
      p_patient_email: data.patientEmail ?? undefined,
      p_national_id: data.nationalId ?? undefined,
      p_gender: data.gender ?? undefined,
      p_reason: data.reason ?? undefined,
      p_notes: data.notes ?? undefined,
      p_patient_id: data.patientId ?? undefined,
    });
    if (error) throw new Error(friendlyRpcError(error.message));
    return { appointmentId: apptId as unknown as string };
  });

// ---------------------------------------------------------------------------
// Staff: release a slot (cancel/reschedule)
// ---------------------------------------------------------------------------
export const releaseSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ appointmentId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: released, error } = await context.supabase.rpc("release_slot", {
      p_appointment_id: data.appointmentId,
    });
    if (error) throw new Error(error.message);
    return { released: !!released };
  });

// ---------------------------------------------------------------------------
// Staff: bulk-generate slots for a doctor on one day
// ---------------------------------------------------------------------------
const generateSchema = z.object({
  doctorId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // "09:00"
  endTime: z.string().regex(/^\d{2}:\d{2}$/), // "17:00"
  durationMinutes: z.number().int().min(5).max(240),
  breakMinutes: z.number().int().min(0).max(60).default(0),
});

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMMSS(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

export const generateSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => generateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Authorize: only admin/reception/doctor can generate slots
    const roleChecks = await Promise.all(
      (["admin", "reception", "doctor"] as const).map((r) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: r as any }),
      ),
    );
    const allowed = roleChecks.some((r) => r.data === true);
    if (!allowed) throw new Error("غير مصرّح بإنشاء فترات المواعيد.");

    const start = toMinutes(data.startTime);
    const end = toMinutes(data.endTime);
    if (end <= start) throw new Error("وقت النهاية يجب أن يكون بعد البداية.");

    const step = data.durationMinutes + data.breakMinutes;
    const rows: Array<{
      doctor_id: string;
      branch_id: string | null;
      slot_date: string;
      start_time: string;
      end_time: string;
      status: "available";
    }> = [];
    for (let t = start; t + data.durationMinutes <= end; t += step) {
      rows.push({
        doctor_id: data.doctorId,
        branch_id: data.branchId ?? null,
        slot_date: data.date,
        start_time: toHHMMSS(t),
        end_time: toHHMMSS(t + data.durationMinutes),
        status: "available",
      });
    }
    if (rows.length === 0) throw new Error("لا توجد فترات ضمن هذا النطاق.");

    // Insert; ignore duplicates on (doctor_id, slot_date, start_time)
    const { data: inserted, error } = await context.supabase
      .from("availability_slots")
      .upsert(rows, {
        onConflict: "doctor_id,slot_date,start_time",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) throw new Error(error.message);
    return {
      requested: rows.length,
      created: inserted?.length ?? 0,
      skipped: rows.length - (inserted?.length ?? 0),
    };
  });
