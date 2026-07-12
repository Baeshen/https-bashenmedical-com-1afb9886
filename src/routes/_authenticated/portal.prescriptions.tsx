import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getMyPrescriptions,
  generateMedicationReminders,
  type PrescriptionItem,
  type ReminderPlan,
} from "@/lib/portal/prescriptions.functions";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Pill,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ar as arLocale } from "date-fns/locale";

const rxQuery = queryOptions({
  queryKey: ["portal", "prescriptions"],
  queryFn: () => getMyPrescriptions(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/portal/prescriptions")({
  loader: async ({ context }) => context.queryClient.ensureQueryData(rxQuery),
  head: () => ({
    meta: [
      { title: "الوصفات الطبية | بوابة المريض" },
      { name: "description", content: "الوصفات الطبية النشطة مع مساعد ذكي لتذكيرات الأدوية والمواعيد." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrescriptionsPage,
  errorComponent: RxError,
  notFoundComponent: () => null,
});

function RxError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="glass-card max-w-md mx-auto p-8 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center bg-red-50 text-red-500 mb-4">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold">تعذّر تحميل الوصفات</h3>
      <p className="text-sm text-[color:var(--portal-ink-2)] mt-2 break-words">
        {error.message || "خطأ غير متوقع."}
      </p>
      <button
        onClick={() => { router.invalidate(); reset(); }}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-4 h-10 text-sm font-semibold text-white"
        style={{ background: "var(--portal-gradient)" }}
      >
        <RefreshCw className="h-4 w-4" /> إعادة المحاولة
      </button>
    </div>
  );
}

/* --------------------------- helpers --------------------------- */

function statusStyle(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-700";
  if (s === "completed") return "bg-slate-100 text-slate-700";
  if (s === "stopped" || s === "cancelled") return "bg-rose-100 text-rose-700";
  if (s === "on_hold" || s === "paused") return "bg-amber-100 text-amber-700";
  return "bg-sky-100 text-sky-700";
}

function daysLeft(end: string | null): number | null {
  if (!end) return null;
  const d = differenceInDays(parseISO(end), new Date());
  return d;
}

/* --------------------------- page --------------------------- */

function PrescriptionsPage() {
  const { data } = useSuspenseQuery(rxQuery);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "past">("active");

  const list = tab === "active" ? data.active : data.past;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) =>
        r.medication.toLowerCase().includes(needle) ||
        (r.dosage ?? "").toLowerCase().includes(needle) ||
        (r.instructions ?? "").toLowerCase().includes(needle),
    );
  }, [list, q]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[color:var(--portal-ink-2)] tracking-wider">PRESCRIPTIONS</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">الوصفات الطبية</h1>
            <p className="text-sm text-[color:var(--portal-ink-2)] mt-1">
              أدويتك النشطة مع مساعد ذكي يقترح تذكيرات مواعيد الجرعات ومواعيدك القادمة.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <KpiPill label="نشطة" value={data.active.length} tone="ok" />
            <KpiPill label="مواعيد قادمة" value={data.upcoming.length} tone="accent" />
            <KpiPill label="سابقة" value={data.past.length} tone="neutral" />
          </div>
        </div>

        <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--portal-ink-2)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم الدواء أو الجرعة…"
              className="w-full h-11 rounded-2xl bg-white/70 pr-10 pl-4 text-sm border border-white/60 outline-none focus:ring-2 focus:ring-[color:var(--portal-accent)]"
            />
          </div>
          <div className="inline-flex rounded-full bg-white/70 p-1 ring-1 ring-white/60">
            <TabBtn active={tab === "active"} onClick={() => setTab("active")}>
              النشطة ({data.active.length})
            </TabBtn>
            <TabBtn active={tab === "past"} onClick={() => setTab("past")}>
              السابقة ({data.past.length})
            </TabBtn>
          </div>
        </div>
      </div>

      {/* AI reminder assistant */}
      <AiReminderCard upcoming={data.upcoming} activeCount={data.active.length} />

      {/* Upcoming appointments strip */}
      {data.upcoming.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[color:var(--portal-accent)]" />
              <h3 className="font-bold">مواعيدك القادمة</h3>
            </div>
            <Link
              to="/portal/book"
              className="text-xs font-semibold text-[color:var(--portal-accent)] hover:underline"
            >
              حجز جديد
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.upcoming.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-gradient-to-br from-sky-50 to-violet-50 ring-1 ring-sky-100 p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs text-[color:var(--portal-ink-2)] inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(parseISO(a.date), "PPP", { locale: arLocale })}
                    {a.time ? ` • ${a.time.slice(0, 5)}` : ""}
                  </div>
                  <Badge className="bg-white/80 text-[color:var(--portal-ink)] border-0">{a.status}</Badge>
                </div>
                <div className="font-semibold">
                  {a.doctor_name ? `د. ${a.doctor_name}` : "طبيب"}
                </div>
                {a.specialty && (
                  <div className="text-xs text-[color:var(--portal-ink-2)] mt-0.5">{a.specialty}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prescription list */}
      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Pill className="h-10 w-10 mx-auto text-[color:var(--portal-ink-2)] mb-3" />
          <p className="text-sm text-[color:var(--portal-ink-2)]">
            {tab === "active" ? "لا توجد وصفات نشطة حالياً." : "لا توجد وصفات سابقة."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <RxCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- subcomponents --------------------------- */

function KpiPill({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "neutral" | "accent" }) {
  const cls =
    tone === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : tone === "warn" ? "bg-rose-50 text-rose-700 ring-rose-200"
    : tone === "accent" ? "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-slate-50 text-slate-700 ring-slate-200";
  return (
    <div className={`rounded-2xl px-4 py-2 ring-1 ${cls}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-bold leading-none mt-0.5">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-full px-4 text-sm font-semibold transition-all ${
        active ? "bg-[color:var(--portal-ink)] text-white" : "text-[color:var(--portal-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function RxCard({ r }: { r: PrescriptionItem }) {
  const dl = daysLeft(r.end_date);
  return (
    <article className="rounded-3xl bg-white/80 ring-1 ring-white/60 p-5 shadow-sm hover:shadow-md transition-all backdrop-blur">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-100 to-sky-100 grid place-items-center text-violet-600">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold leading-tight">{r.medication}</h3>
            <p className="text-xs text-[color:var(--portal-ink-2)] mt-0.5">
              {[r.dosage, r.frequency, r.route].filter(Boolean).join(" • ") || "بدون تفاصيل جرعة"}
            </p>
          </div>
        </div>
        <Badge className={`${statusStyle(r.status)} border-0`}>{r.status ?? "—"}</Badge>
      </header>

      {r.instructions && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm mb-3">
          <span className="text-xs text-slate-500 block mb-0.5">التعليمات</span>
          {r.instructions}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs">
        {r.start_date && (
          <Field label="البداية" value={format(parseISO(r.start_date), "PPP", { locale: arLocale })} />
        )}
        {r.end_date && (
          <Field
            label="النهاية"
            value={`${format(parseISO(r.end_date), "PPP", { locale: arLocale })}${
              dl !== null ? ` (${dl >= 0 ? `${dl} يوم متبقي` : "منتهية"})` : ""
            }`}
          />
        )}
        {r.refills_remaining !== null && (
          <Field label="إعادة الصرف" value={`${r.refills_remaining} مرة`} />
        )}
        {r.doctor_name && <Field label="الطبيب" value={`د. ${r.doctor_name}`} />}
      </dl>

      {r.notes && (
        <p className="mt-3 text-xs text-[color:var(--portal-ink-2)] line-clamp-3">{r.notes}</p>
      )}

      <footer className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[color:var(--portal-ink-2)]">
          {r.source === "prescription" ? "وصفة طبيب" : "دواء مسجل"}
        </span>
        {r.doctor_name && (
          <span className="text-xs text-[color:var(--portal-ink-2)] inline-flex items-center gap-1">
            <Stethoscope className="h-3.5 w-3.5" /> {r.doctor_name}
          </span>
        )}
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50/70 px-2.5 py-1.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

/* --------------------------- AI assistant --------------------------- */

function AiReminderCard({ upcoming, activeCount }: { upcoming: unknown[]; activeCount: number }) {
  const mut = useMutation({
    mutationFn: () => generateMedicationReminders({ data: {} }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر توليد الخطة"),
    onSuccess: () => toast.success("تم توليد جدول التذكيرات."),
  });
  const plan = mut.data as ReminderPlan | undefined;

  const grouped = useMemo(() => {
    if (!plan) return [];
    const map = new Map<string, typeof plan.slots>();
    for (const s of plan.slots) {
      const key = s.time.slice(0, 5);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [plan]);

  return (
    <div
      className="rounded-3xl p-5 md:p-6 text-white shadow-lg relative overflow-hidden"
      style={{ background: "var(--portal-gradient)" }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle at 80% 20%, white, transparent 40%)" }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/20 grid place-items-center backdrop-blur">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs opacity-80 tracking-wider">AI ASSISTANT</div>
            <h3 className="text-lg md:text-xl font-bold mt-0.5">
              {plan?.headline ?? "مساعد التذكيرات الذكي"}
            </h3>
            <p className="text-sm opacity-90 mt-1 max-w-2xl">
              {plan?.overview ??
                `اقترح جدولاً يوميًا لتذكيرات أدويتك (${activeCount} دواء نشط) مع تنبيهات لمواعيدك القادمة (${upcoming.length}).`}
            </p>
          </div>
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || activeCount === 0}
          className="shrink-0 inline-flex items-center gap-2 rounded-full h-10 px-4 text-sm font-semibold bg-white/20 hover:bg-white/30 backdrop-blur disabled:opacity-60"
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {plan ? "تحديث الخطة" : "توليد الخطة"}
        </button>
      </div>

      {activeCount === 0 && !plan && (
        <p className="relative mt-4 text-sm bg-white/10 backdrop-blur rounded-xl px-3 py-2">
          لا توجد أدوية نشطة حالياً لتوليد جدول تذكيرات.
        </p>
      )}

      {plan && (
        <div className="relative mt-5 grid lg:grid-cols-3 gap-4">
          {/* Slots timeline */}
          <div className="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur p-4">
            <div className="text-xs font-semibold opacity-80 mb-3">جدول اليوم</div>
            {grouped.length === 0 ? (
              <p className="text-sm opacity-80">لم يتم توليد أي فترات.</p>
            ) : (
              <ul className="space-y-3">
                {grouped.map(([time, slots]) => (
                  <li key={time} className="flex gap-3">
                    <div className="shrink-0 w-16 rounded-xl bg-white/15 grid place-items-center py-2">
                      <div className="text-lg font-bold tabular-nums leading-none">{time}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{slots[0].label}</div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {slots.map((s, i) => (
                        <div key={i} className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{s.medication}</span>
                            {s.dosage && <span className="text-xs opacity-80">{s.dosage}</span>}
                          </div>
                          {s.note && <div className="text-xs opacity-80 mt-0.5">{s.note}</div>}
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Appointment reminders + warnings */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/10 backdrop-blur p-4">
              <div className="text-xs font-semibold opacity-80 mb-2 inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> تذكيرات المواعيد
              </div>
              {plan.appointmentReminders.length === 0 ? (
                <p className="text-xs opacity-80">لا توجد تذكيرات مواعيد قادمة.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {plan.appointmentReminders.map((a, i) => (
                    <li key={i}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            a.priority === "high" ? "bg-rose-300" : a.priority === "medium" ? "bg-amber-300" : "bg-emerald-300"
                          }`}
                        />
                        <span className="font-semibold">{a.when}</span>
                      </div>
                      <p className="opacity-90 text-xs mt-0.5 mr-3.5">{a.action}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {plan.warnings.length > 0 && (
              <div className="rounded-2xl bg-rose-500/20 backdrop-blur p-4 ring-1 ring-rose-200/30">
                <div className="text-xs font-semibold mb-2 inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> تنبيهات
                </div>
                <ul className="space-y-1 text-xs">
                  {plan.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-[10px] opacity-70 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              تم التوليد {format(parseISO(plan.generatedAt), "PPPp", { locale: arLocale })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
