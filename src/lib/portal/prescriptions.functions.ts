/**
 * Prescriptions + active medications + AI reminder assistant that considers upcoming appointments.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PrescriptionItem = {
  id: string;
  medication: string;
  dosage: string | null;
  instructions: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  refills_remaining: number | null;
  notes: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  source: "prescription" | "medication";
  frequency?: string | null;
  route?: string | null;
};

export type UpcomingAppointment = {
  id: string;
  date: string;
  time: string | null;
  doctor_name: string | null;
  specialty: string | null;
  status: string;
  reason: string | null;
};

export type PrescriptionsPayload = {
  active: PrescriptionItem[];
  past: PrescriptionItem[];
  upcoming: UpcomingAppointment[];
  patient: { id: string; full_name_ar: string | null } | null;
};

export const getMyPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrescriptionsPayload> => {
    const { supabase, userId } = context;

    const patientRes = await supabase
      .from("patients")
      .select("id, full_name_ar")
      .eq("profile_id", userId)
      .maybeSingle();

    const patient = patientRes.data
      ? { id: patientRes.data.id as string, full_name_ar: (patientRes.data.full_name_ar as string | null) ?? null }
      : null;

    if (!patient) return { active: [], past: [], upcoming: [], patient: null };

    const [rxRes, medsRes, aptsRes] = await Promise.all([
      supabase
        .from("prescriptions")
        .select("id, medication, dosage, instructions, status, start_date, end_date, refills_remaining, notes, doctor_id, doctors:doctor_id(name_ar)")
        .eq("patient_id", patient.id)
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase
        .from("patient_medications")
        .select("id, medication_name, dosage, frequency, route, start_date, end_date, status, prescribed_by_name, notes")
        .eq("patient_id", patient.id)
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, reason, doctor_id, doctors:doctor_id(name_ar, specialties:specialty_id(name_ar))")
        .eq("patient_id", patient.id)
        .gte("appointment_date", new Date().toISOString().slice(0, 10))
        .in("status", ["new", "confirmed"])
        .order("appointment_date", { ascending: true })
        .limit(20),
    ]);

    const items: PrescriptionItem[] = [];
    for (const r of rxRes.data ?? []) {
      items.push({
        id: `rx-${r.id}`,
        medication: (r.medication as string) ?? "",
        dosage: (r.dosage as string | null) ?? null,
        instructions: (r.instructions as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        start_date: (r.start_date as string | null) ?? null,
        end_date: (r.end_date as string | null) ?? null,
        refills_remaining: (r.refills_remaining as number | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        doctor_id: (r.doctor_id as string | null) ?? null,
        doctor_name:
          ((r as { doctors?: { name_ar?: string | null } | null }).doctors?.name_ar as string | null) ?? null,
        source: "prescription",
      });
    }
    for (const m of medsRes.data ?? []) {
      items.push({
        id: `med-${m.id}`,
        medication: (m.medication_name as string) ?? "",
        dosage: (m.dosage as string | null) ?? null,
        instructions: null,
        status: (m.status as string | null) ?? null,
        start_date: (m.start_date as string | null) ?? null,
        end_date: (m.end_date as string | null) ?? null,
        refills_remaining: null,
        notes: (m.notes as string | null) ?? null,
        doctor_id: null,
        doctor_name: (m.prescribed_by_name as string | null) ?? null,
        source: "medication",
        frequency: (m.frequency as string | null) ?? null,
        route: (m.route as string | null) ?? null,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const active: PrescriptionItem[] = [];
    const past: PrescriptionItem[] = [];
    for (const it of items) {
      const isActive =
        (it.status ?? "").toLowerCase() === "active" ||
        (!it.end_date || it.end_date >= today) && (it.status ?? "active").toLowerCase() !== "cancelled" &&
        (it.status ?? "active").toLowerCase() !== "stopped" && (it.status ?? "active").toLowerCase() !== "completed";
      if (isActive) active.push(it);
      else past.push(it);
    }

    const upcoming: UpcomingAppointment[] = (aptsRes.data ?? []).map((a) => {
      const doc = (a as { doctors?: { name_ar?: string | null; specialties?: { name_ar?: string | null } | null } | null }).doctors;
      return {
        id: a.id as string,
        date: a.appointment_date as string,
        time: (a.appointment_time as string | null) ?? null,
        doctor_name: (doc?.name_ar as string | null) ?? null,
        specialty: (doc?.specialties?.name_ar as string | null) ?? null,
        status: (a.status as string) ?? "pending",
        reason: (a.reason as string | null) ?? null,
      };
    });

    return { active, past, upcoming, patient };
  });

/* --------------------------- AI reminder plan --------------------------- */

export type ReminderSlot = {
  medication: string;
  dosage: string | null;
  time: string; // HH:mm 24h
  label: string; // e.g. "الفطور", "قبل النوم"
  note?: string | null;
};

export type ReminderPlan = {
  headline: string;
  overview: string;
  slots: ReminderSlot[];
  appointmentReminders: {
    appointment_id: string;
    when: string; // e.g. "غداً 9:00"
    action: string;
    priority: "high" | "medium" | "low";
  }[];
  warnings: string[];
  generatedAt: string;
  model: string;
};

const PlanInput = z.object({
  preferredWakeHour: z.number().int().min(4).max(11).optional(),
  preferredSleepHour: z.number().int().min(20).max(26).optional(),
});

export const generateMedicationReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PlanInput.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<ReminderPlan> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير مهيأ.");
    const { supabase, userId } = context;

    const patientRes = await supabase
      .from("patients").select("id, full_name_ar").eq("profile_id", userId).maybeSingle();
    if (!patientRes.data) throw new Error("لا يوجد ملف مريض مرتبط.");
    const pid = patientRes.data.id;

    const today = new Date().toISOString().slice(0, 10);
    const [medsRes, allergyRes, aptsRes] = await Promise.all([
      supabase
        .from("patient_medications")
        .select("medication_name, dosage, frequency, route, notes, status, start_date, end_date")
        .eq("patient_id", pid)
        .limit(60),
      supabase
        .from("patient_allergies").select("allergen, reaction, severity").eq("patient_id", pid).limit(20),
      supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, reason, status, doctors:doctor_id(name_ar, specialties:specialty_id(name_ar))")
        .eq("patient_id", pid)
        .gte("appointment_date", today)
        .in("status", ["new", "confirmed"])
        .order("appointment_date", { ascending: true })
        .limit(10),
    ]);

    const activeMeds = (medsRes.data ?? []).filter((m) => {
      const status = ((m.status as string | null) ?? "").toLowerCase();
      if (status === "stopped" || status === "cancelled" || status === "completed") return false;
      const end = m.end_date as string | null;
      return !end || end >= today;
    });

    const facts = {
      patient: patientRes.data.full_name_ar,
      preferences: {
        wakeHour: data.preferredWakeHour ?? 7,
        sleepHour: data.preferredSleepHour ?? 23,
      },
      activeMedications: activeMeds,
      allergies: allergyRes.data ?? [],
      upcomingAppointments: aptsRes.data ?? [],
      today,
    };

    const model = "google/gemini-2.5-flash";
    const system =
      "أنت مساعد صحي يقترح جدول تذكيرات دوائية آمنًا ومنطقيًا للمريض. اكتب بالعربية بلهجة واضحة. لا تصف جرعات جديدة ولا تغيّر الجرعات المسجلة؛ فقط وزّع الجرعات على أوقات مناسبة اعتمادًا على التكرار المذكور (مثل مرة يومياً، مرتين، كل 8 ساعات). أضف ملاحظات مثل مع/بدون طعام إذا ورد. اربط تذكيرات المواعيد القادمة بشكل مختصر (اليوم/الساعة/الإجراء). لا تخترع أدوية أو مواعيد غير موجودة.";
    const user = `بيانات المريض (JSON):\n${JSON.stringify(facts, null, 2)}\n\nأعد النتيجة بصيغة JSON وفق المخطط فقط. استخدم توقيت 24 ساعة بصيغة HH:MM. لكل دواء أعد تذكيرات كافية لتغطية تكراره اليومي.`;

    const schema = {
      type: "object",
      properties: {
        headline: { type: "string" },
        overview: { type: "string" },
        slots: {
          type: "array", minItems: 0, maxItems: 40,
          items: {
            type: "object",
            properties: {
              medication: { type: "string" },
              dosage: { type: ["string", "null"] },
              time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
              label: { type: "string" },
              note: { type: ["string", "null"] },
            },
            required: ["medication", "dosage", "time", "label"],
            additionalProperties: false,
          },
        },
        appointmentReminders: {
          type: "array", minItems: 0, maxItems: 10,
          items: {
            type: "object",
            properties: {
              appointment_id: { type: "string" },
              when: { type: "string" },
              action: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["appointment_id", "when", "action", "priority"],
            additionalProperties: false,
          },
        },
        warnings: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
      },
      required: ["headline", "overview", "slots", "appointmentReminders", "warnings"],
      additionalProperties: false,
    };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{ type: "function", function: { name: "emit_plan", description: "خطة التذكيرات", parameters: schema } }],
        tool_choice: { type: "function", function: { name: "emit_plan" } },
      }),
    });

    if (r.status === 429) throw new Error("تم تجاوز الحد. حاول لاحقاً.");
    if (r.status === 402) throw new Error("انتهت أرصدة الذكاء الاصطناعي.");
    if (!r.ok) throw new Error(`فشل الذكاء الاصطناعي: ${r.status}`);
    const j = (await r.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[]; content?: string } }[];
    };
    const raw =
      j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ??
      j.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<ReminderPlan> = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    return {
      headline: parsed.headline ?? "خطة التذكيرات اليومية",
      overview: parsed.overview ?? "",
      slots: parsed.slots ?? [],
      appointmentReminders: parsed.appointmentReminders ?? [],
      warnings: parsed.warnings ?? [],
      generatedAt: new Date().toISOString(),
      model,
    };
  });
