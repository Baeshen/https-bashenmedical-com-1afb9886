import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import manifest from "../../../.lovable/mcp/manifest.json";
import { getLastMcpInvocations, type LastToolInvocation } from "@/lib/mcp-diagnostics.functions";

export const Route = createFileRoute("/_authenticated/mcp-status")({
  head: () => ({
    meta: [
      { title: "حالة MCP | مجمع باعشن الطبي" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: McpStatusPage,
});

type CheckState = "idle" | "loading" | "ok" | "error";
type Check = { state: CheckState; message?: string; data?: unknown };

function Row({ label, check }: { label: string; check: Check }) {
  const color =
    check.state === "ok"
      ? "bg-emerald-500"
      : check.state === "error"
        ? "bg-destructive"
        : check.state === "loading"
          ? "bg-amber-500 animate-pulse"
          : "bg-muted-foreground/50";
  const text =
    check.state === "ok"
      ? "متصل"
      : check.state === "error"
        ? "خطأ"
        : check.state === "loading"
          ? "جارٍ الفحص..."
          : "لم يُفحص";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {check.message && (
          <div className="mt-1 text-xs text-muted-foreground break-all">{check.message}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
        <span>{text}</span>
      </div>
    </div>
  );
}

function McpStatusPage() {
  const [oauthMeta, setOauthMeta] = useState<Check>({ state: "idle" });
  const [issuerMeta, setIssuerMeta] = useState<Check>({ state: "idle" });
  const [mcpPing, setMcpPing] = useState<Check>({ state: "idle" });

  const tools = manifest.mcp?.tools ?? [];
  const serverName = manifest.mcp?.server?.name ?? "—";
  const serverTitle = manifest.mcp?.server?.title ?? serverName;
  const serverVersion = manifest.mcp?.server?.version ?? "—";
  const issuer = manifest.auth?.issuer ?? "";
  const mcpPath = manifest.path ?? "/mcp";

  async function runChecks() {
    // 1) Protected-resource metadata (public)
    setOauthMeta({ state: "loading" });
    try {
      const res = await fetch("/.well-known/oauth-protected-resource");
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOauthMeta({
        state: "ok",
        message: `resource: ${(body as any)?.resource ?? "—"}`,
        data: body,
      });
    } catch (e: any) {
      setOauthMeta({ state: "error", message: e?.message ?? String(e) });
    }

    // 2) OAuth issuer discovery
    if (issuer) {
      setIssuerMeta({ state: "loading" });
      try {
        const res = await fetch(`${issuer}/.well-known/openid-configuration`);
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setIssuerMeta({
          state: "ok",
          message: `issuer: ${(body as any)?.issuer ?? issuer}`,
          data: body,
        });
      } catch (e: any) {
        setIssuerMeta({ state: "error", message: e?.message ?? String(e) });
      }
    }

    // 3) MCP endpoint reachability (initialize JSON-RPC).
    // Without an OAuth bearer this returns 401 with WWW-Authenticate — that's a
    // GOOD sign: it means the server is up and OAuth is enforced.
    setMcpPing({ state: "loading" });
    try {
      const res = await fetch(mcpPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "mcp-status-page", version: "1.0" },
          },
        }),
      });
      if (res.status === 401) {
        const wwwAuth = res.headers.get("www-authenticate") ?? "";
        setMcpPing({
          state: "ok",
          message: `الخادم يعمل ويطلب مصادقة OAuth (401). WWW-Authenticate: ${wwwAuth || "—"}`,
        });
      } else if (res.ok) {
        setMcpPing({ state: "ok", message: `HTTP ${res.status} — استجاب دون طلب مصادقة` });
      } else {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      }
    } catch (e: any) {
      setMcpPing({ state: "error", message: e?.message ?? String(e) });
    }
  }

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container-app py-10" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">حالة اتصال MCP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          فحص خادم MCP الخاص بالتطبيق، إعدادات OAuth، والأدوات المُسجّلة.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">معلومات الخادم</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">الاسم</dt>
            <dd className="font-medium">{serverTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">المعرّف</dt>
            <dd className="font-mono">{serverName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">الإصدار</dt>
            <dd className="font-mono">{serverVersion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">المسار</dt>
            <dd className="font-mono">{mcpPath}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">OAuth Issuer</dt>
            <dd className="font-mono break-all">{issuer || "غير مُهيّأ"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">الفحوصات الحية</h2>
          <button
            type="button"
            onClick={runChecks}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            إعادة الفحص
          </button>
        </div>
        <Row label="Protected-resource metadata (/.well-known)" check={oauthMeta} />
        <Row label="OAuth issuer discovery" check={issuerMeta} />
        <Row label={`اتصال بخادم MCP (${mcpPath})`} check={mcpPing} />
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">
          الأدوات المُسجّلة <span className="text-muted-foreground">({tools.length})</span>
        </h2>
        {tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد أدوات مُعلَنة في manifest.</p>
        ) : (
          <ul className="divide-y divide-border">
            {tools.map((t: any) => (
              <li key={t.name} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{t.name}</span>
                  {t.annotations?.readOnlyHint && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      read-only
                    </span>
                  )}
                  {t.annotations?.destructiveHint && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                      destructive
                    </span>
                  )}
                </div>
                {t.title && <div className="mt-0.5 text-sm">{t.title}</div>}
                {t.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ToolInvocationsSection toolNames={tools.map((t: any) => t.name)} />
    </main>
  );
}

function ToolInvocationsSection({ toolNames }: { toolNames: string[] }) {
  const fetchInvocations = useServerFn(getLastMcpInvocations);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["mcp-last-invocations"],
    queryFn: () => fetchInvocations(),
    staleTime: 30_000,
  });

  const byName = new Map<string, LastToolInvocation>();
  for (const row of data ?? []) byName.set(row.tool_name, row);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">آخر استدعاء لكل أداة</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            يعرض آخر مرة استدعى فيها حسابك الأداة عبر MCP (لا تُسجَّل الاستدعاءات المجهولة).
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          disabled={isFetching}
        >
          {isFetching ? "..." : "تحديث"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          تعذّر تحميل السجل: {(error as Error)?.message ?? "خطأ غير معروف"}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {toolNames.map((name) => {
            const row = byName.get(name);
            return (
              <li key={name} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{name}</span>
                    {row ? (
                      row.is_error ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          فشل
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          نجاح
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        لم يُستخدم
                      </span>
                    )}
                  </div>
                  {row && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <time dateTime={row.invoked_at} title={row.invoked_at}>
                        {new Date(row.invoked_at).toLocaleString("ar")}
                      </time>
                      {row.duration_ms != null && (
                        <span className="font-mono">{row.duration_ms} ms</span>
                      )}
                    </div>
                  )}
                </div>
                {row?.args_summary && (
                  <div className="mt-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      الوسائط
                    </div>
                    <pre className="mt-0.5 overflow-x-auto rounded bg-muted/50 p-2 text-[11px] font-mono leading-snug">
                      {row.args_summary}
                    </pre>
                  </div>
                )}
                {row?.result_summary && (
                  <div className="mt-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      النتيجة
                    </div>
                    <pre className="mt-0.5 overflow-x-auto rounded bg-muted/50 p-2 text-[11px] font-mono leading-snug whitespace-pre-wrap break-all">
                      {row.result_summary}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
