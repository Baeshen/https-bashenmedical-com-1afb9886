import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_branches",
  title: "List clinic branches",
  description:
    "List all active branches of Baeshen Medical Complex with basic contact info (name, city, phone, address).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await supabase
      .from("branches")
      .select(
        "id, slug, name_ar, name_en, city_ar, city_en, phone, emergency_phone, address_ar, address_en",
      )
      .order("sort_order", { ascending: true });

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { branches: data ?? [] },
    };
  },
});
