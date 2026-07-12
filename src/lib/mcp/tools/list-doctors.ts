import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_doctors",
  title: "List doctors",
  description:
    "List active doctors at Baeshen Medical Complex. Optionally filter by branch slug or specialty slug. Returns up to 50 doctors per call.",
  inputSchema: {
    branch_slug: z.string().trim().optional().describe("Optional branch slug filter."),
    specialty_slug: z.string().trim().optional().describe("Optional specialty slug filter."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_slug, specialty_slug, limit }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let query = supabase
      .from("doctors")
      .select(
        "id, slug, name_ar, name_en, title_ar, title_en, specialty_id, branch_id, is_active, languages, specialties:specialty_id(slug, name_ar, name_en), branches:branch_id(slug, name_ar, name_en)",
      )
      .eq("is_active", true)
      .limit(limit ?? 20);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    let rows = data ?? [];
    if (branch_slug) {
      rows = rows.filter((r: any) => r.branches?.slug === branch_slug);
    }
    if (specialty_slug) {
      rows = rows.filter((r: any) => r.specialties?.slug === specialty_slug);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { doctors: rows },
    };
  },
});
