import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { logMcpInvocation } from "../log-invocation";

export default defineTool({
  name: "list_my_appointments",
  title: "List my appointments",
  description:
    "List appointments visible to the signed-in user. Row-level security limits results to appointments the user is authorized to see.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    const startedAt = Date.now();
    const args = { limit };
    if (!ctx.isAuthenticated()) {
      const result = {
        content: [{ type: "text" as const, text: "Not authenticated" }],
        isError: true,
      };
      return result;
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
      .select(
        "id, status, appointment_date, appointment_time, patient_name, patient_phone, doctor_id, branch_id, service_id, created_at",
      )
      .order("appointment_date", { ascending: false })
      .limit(limit ?? 20);

    const result = error
      ? {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        }
      : {
          content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }],
          structuredContent: { appointments: data ?? [] },
        };

    await logMcpInvocation({ ctx, toolName: "list_my_appointments", args, result, startedAt });
    return result;
  },
});
