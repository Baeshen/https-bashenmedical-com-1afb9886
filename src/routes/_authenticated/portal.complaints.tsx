import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Radio,
  Copy,
  ChevronRight,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyComplaints, submitMyComplaint } from "@/lib/complaints.functions";
import { getMyProfile } from "@/lib/portal/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/complaints")({
  head: () => ({
    meta: [
      { title: "بلاغاتي — بوابة المريض" },
      { name: "description", content: "شكاواي ومقترحاتي وحالتها الحالية." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyComplaintsPage,
});

const STATUS_AR: Record<string, string> = {
  submitted: "تم الإرسال",
  under_review: "تحت المراجعة",
  waiting_patient: "بانتظار إجراء منك",
  resolved: "تم الحل",
  closed: "مغلق",
};
const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-primary/10 text-primary border-primary/30",
  under_review: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  waiting_patient: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  resolved: "bg-green-500/10 text-green-700 border-green-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};
const TYPE_AR: Record<string, string> = {
  complaint: "شكوى",
  suggestion: "اقتراح",
  thanks: "شكر",
  inquiry: "استفسار",
};
const STAGES: Array<{ key: string; label: string }> = [
  { key: "submitted", label: "تم الإرسال" },
  { key: "under_review", label: "تحت المراجعة" },
  { key: "resolved", label: "تم الحل" },
];

function MyComplaintsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyComplaints);
  const submitFn = useServerFn(submitMyComplaint);
  const profileFn = useServerFn(getMyProfile);

  const listQuery = useQuery({
    queryKey: ["portal", "my-complaints"],
    queryFn: () => listFn(),
  });
  const profileQuery = useQuery({
    queryKey: ["portal", "my-profile"],
    queryFn: () => profileFn(),
    staleTime: 60_000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [live, setLive] = useState(false);

  // Realtime — refresh on any change to the user's complaints.
  useEffect(() => {
    const uid = profileQuery.data?.id;
    if (!uid) return;
    const ch = supabase
      .channel(`my-complaints-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "complaints",
          filter: `patient_user_id=eq.${uid}`,
        },
        () => qc.invalidateQueries({ queryKey: ["portal", "my-complaints"] }),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
      setLive(false);
    };
  }, [profileQuery.data?.id, qc]);

  const rows = listQuery.data ?? [];
  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-primary" />
            بلاغاتي
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Radio className={`h-3 w-3 ${live ? "text-green-600 animate-pulse" : ""}`} />
            {live ? "تحديث مباشر" : "غير متصل"} · {rows.length} بلاغ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => listQuery.refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            تحديث
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> بلاغ جديد
          </button>
        </div>
      </header>

      {listQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState onNew={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="w-full text-start rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.reference}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {TYPE_AR[r.type] ?? r.type}
                    </span>
                    {r.department && (
                      <span className="text-xs text-muted-foreground">
                        · {r.department}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm line-clamp-2 text-muted-foreground">
                    {r.message}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                      STATUS_COLOR[r.status] ?? ""
                    }`}
                  >
                    {STATUS_AR[r.status] ?? r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal onClose={() => setSelectedId(null)} title={`بلاغ ${selected.reference}`}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                  STATUS_COLOR[selected.status] ?? ""
                }`}
              >
                {STATUS_AR[selected.status] ?? selected.status}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                {TYPE_AR[selected.type] ?? selected.type}
              </span>
              {selected.department && (
                <span className="text-xs text-muted-foreground">
                  · {selected.department}
                </span>
              )}
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(selected.reference);
                  toast.success("تم نسخ الرقم");
                }}
                className="ms-auto inline-flex items-center gap-1 text-xs text-primary"
              >
                <Copy className="h-3.5 w-3.5" /> نسخ الرقم
              </button>
            </div>

            <Timeline currentStatus={selected.status} />

            <div>
              <p className="text-xs text-muted-foreground mb-1">الرسالة</p>
              <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">
                {selected.message}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <p>تاريخ الإرسال</p>
                <p className="text-foreground mt-0.5">
                  {new Date(selected.created_at).toLocaleString("ar-SA")}
                </p>
              </div>
              <div>
                <p>آخر تحديث</p>
                <p className="text-foreground mt-0.5">
                  {new Date(selected.updated_at).toLocaleString("ar-SA")}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* New complaint modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="إرسال بلاغ جديد">
          <NewComplaintForm
            defaultName={profileQuery.data?.full_name ?? ""}
            defaultPhone={profileQuery.data?.phone ?? ""}
            defaultEmail=""
            submitFn={submitFn}
            onDone={() => {
              setShowForm(false);
              qc.invalidateQueries({ queryKey: ["portal", "my-complaints"] });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <MessageSquareWarning className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 font-bold">لا توجد بلاغات بعد</h3>
      <p className="text-sm text-muted-foreground mt-1">
        شاركنا شكواك أو اقتراحك — نتواصل معك خلال 48 ساعة عمل.
      </p>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> إرسال بلاغ
      </button>
    </div>
  );
}

function Timeline({ currentStatus }: { currentStatus: string }) {
  // Cancelled/closed shown as its own final state
  const closedState = currentStatus === "closed" || currentStatus === "waiting_patient";
  const currentIdx =
    currentStatus === "resolved" ? 2 : currentStatus === "under_review" ? 1 : 0;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">مراحل معالجة البلاغ</p>
      <ol className="flex items-center gap-2">
        {STAGES.map((s, i) => {
          const done = i <= currentIdx && currentStatus !== "waiting_patient";
          return (
            <li key={s.key} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  done ? "bg-primary" : "bg-muted"
                }`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground text-center">
                {s.label}
              </p>
            </li>
          );
        })}
      </ol>
      {currentStatus === "waiting_patient" && (
        <p className="mt-2 text-xs text-orange-700 bg-orange-500/10 border border-orange-500/30 rounded p-2">
          يحتاج البلاغ إجراءً منك — يرجى مراجعة تفاصيلك أو التواصل مع فريق تجربة المريض.
        </p>
      )}
      {closedState && currentStatus === "closed" && (
        <p className="mt-2 text-xs text-muted-foreground">تم إغلاق البلاغ.</p>
      )}
    </div>
  );
}

function NewComplaintForm({
  defaultName,
  defaultPhone,
  defaultEmail,
  submitFn,
  onDone,
}: {
  defaultName: string;
  defaultPhone: string;
  defaultEmail: string;
  submitFn: ReturnType<typeof useServerFn<typeof submitMyComplaint>>;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: defaultName,
    phone: defaultPhone,
    email: defaultEmail,
    type: "complaint" as "complaint" | "suggestion" | "thanks" | "inquiry",
    department: "",
    message: "",
  });
  const mut = useMutation({
    mutationFn: (input: typeof form) => submitFn({ data: input }),
    onSuccess: (res) => {
      toast.success(`تم إرسال البلاغ — رقم ${res.reference}`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الإرسال."),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(form);
      }}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">الاسم</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">رقم الجوال</span>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">النوع</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="complaint">شكوى</option>
            <option value="suggestion">اقتراح</option>
            <option value="thanks">شكر</option>
            <option value="inquiry">استفسار</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">القسم (اختياري)</span>
          <input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="الاستقبال، المختبر، الأشعة…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="text-sm">
        <span className="font-medium">التفاصيل</span>
        <textarea
          required
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={mut.isPending}
        className="rounded-md bg-primary text-primary-foreground font-semibold py-2.5 disabled:opacity-60"
      >
        {mut.isPending ? "جارٍ الإرسال…" : "إرسال البلاغ"}
      </button>
    </form>
  );
}

function Modal({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
