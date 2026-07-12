
CREATE TABLE public.mcp_tool_invocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  args_summary JSONB,
  result_summary TEXT,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mcp_tool_invocations_user_tool_time_idx
  ON public.mcp_tool_invocations (user_id, tool_name, invoked_at DESC);

GRANT SELECT, INSERT ON public.mcp_tool_invocations TO authenticated;
GRANT ALL ON public.mcp_tool_invocations TO service_role;

ALTER TABLE public.mcp_tool_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MCP invocations"
  ON public.mcp_tool_invocations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MCP invocations"
  ON public.mcp_tool_invocations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
