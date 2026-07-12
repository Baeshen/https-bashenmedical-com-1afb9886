import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "create_appointment",
  title: "Create appointment",
  description:
    "Create a new appointment. Requires an authenticated user; row-level security controls what can be inserted and read back. Date must be today or later.",
  inputSchema: {
    patient_name: z.string().trim().min(2).max(120).describe("Patient full name."),
    patient_phone: z.string().trim().min(6).max(32).describe("Patient phone number."),
    appointment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Appointment date (YYYY-MM-DD)."),
    appointment_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .describe("Appointment time (HH:MM or HH:MM:SS)."),
    doctor_id: z.string().uuid().optional().describe("Optional doctor UUID."),
    branch_id: z.string().uuid().optional().describe("Optional branch UUID."),
    specialty_id: z.string().uuid().optional().describe("Optional specialty UUID."),
    patient_email: z.string().email().optional().describe("Optional patient email."),
    reason: z.string().trim().max(500).optional().describe("Optional visit reason."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_name: input.patient_name,
        patient_phone: input.patient_phone,
        appointment_date: input.appointment_date,
        appointment_time: input.appointment_time,
        doctor_id: input.doctor_id ?? null,
        branch_id: input.branch_id ?? null,
        specialty_id: input.specialty_id ?? null,
        patient_email: input.patient_email ?? null,
        reason: input.reason ?? null,
      })
      .select(
        "id, status, appointment_date, appointment_time, patient_name, patient_phone, doctor_id, branch_id, specialty_id, created_at",
      )
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { appointment: data },
    };
  },
});
