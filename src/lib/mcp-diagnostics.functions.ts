import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LastToolInvocation = {
  tool_name: string;
  is_error: boolean;
  duration_ms: number | null;
  args_summary: Record<string, unknown> | null;
  result_summary: string | null;
  invoked_at: string;
};

type Row = {
  tool_name: string;
  is_error: boolean;
  duration_ms: number | null;
  args_summary: Record<string, unknown> | null;
  result_summary: string | null;
  invoked_at: string;
};

/**
 * Returns the most recent invocation per tool for the signed-in user.
 * RLS scopes rows to the current user, so no extra `user_id` filter needed.
 */
export const getLastMcpInvocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LastToolInvocation[]> => {
    const { supabase } = context;
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => { limit: (n: number) => Promise<{ data: Row[] | null; error: { message: string } | null }> };
          };
        };
      }
    )
      .from("mcp_tool_invocations")
      .select("tool_name, is_error, duration_ms, args_summary, result_summary, invoked_at")
      .order("invoked_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const latest = new Map<string, LastToolInvocation>();
    for (const row of data ?? []) {
      if (!latest.has(row.tool_name)) latest.set(row.tool_name, row);
    }
    return Array.from(latest.values());
  });
