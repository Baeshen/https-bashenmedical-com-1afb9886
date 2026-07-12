import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/portal/portal.functions";
import {
  CalendarCheck,
  Stethoscope,
  Activity,
  Bell,
  Pill,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FlaskConical,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const dashboardQuery = queryOptions({
  queryKey: ["portal", "dashboard-summary"],
  queryFn: () => getDashboardSummary(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/portal/")({
  loader: async ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({
    meta: [
      { title: "لوحة تحكم المريض | مجمع باعشن الطبي" },
      { name: "description", content: "لوحة تحكم المريض في مجمع باعشن الطبي." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalDashboard,
  errorComponent: DashboardError,
  notFoundComponent: () => null,
});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="glass-card max-w-md mx-auto p-8 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center bg-red-50 text-red-500 mb-4">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold">تعذّر تحميل اللوحة</h3>
      <p className="text-sm text-[color:var(--portal-ink-2)] mt-2 break-words">
        {error.message || "خطأ غير متوقع."}
      </p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-4 h-10 text-sm font-semibold text-white"
        style={{ background: "var(--portal-gradient)" }}
      >
        <RefreshCw className="h-4 w-4" />
        إعادة المحاولة
      </button>
    </div>
  );
}

function PortalDashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const isAr = (data.profile?.preferred_language as string | undefined) !== "en";
  const today = new Date().toLocaleDateString(isAr ? "ar-SA-u-nu-latn" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const firstName =
    (data.profile?.full_name?.trim().split(/\s+/)[0]) || (isAr ? "بك" : "there");

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Welcome hero */}
      <section
        className="relative overflow-hidden rounded-[28px] p-6 md:p-8 text-white shadow-[0_30px_80px_-40px_rgba(15,108,189,0.55)]"
        style={{ background: "var(--portal-gradient)" }}
      >
        <div className="absolute -top-16 -end-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -start-10 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-5 flex-wrap">
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center text-2xl md:text-3xl font-bold ring-2 ring-white/25">
            {firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="text-white/80 text-xs md:text-sm tracking-wide">
              {isAr ? "أهلًا بك مجددًا" : "Welcome back"}
            </div>
            <h1 className="text-2xl md:text-4xl font-bold mt-1">
              {isAr ? `مرحبًا، ${firstName}` : `Hi, ${firstName}`}
            </h1>
            <div className="text-white/75 text-xs md:text-sm mt-1">{today}</div>
          </div>
          <Link
            to="/portal/book"
            className="inline-flex items-center gap-2 rounded-full bg-white text-[color:var(--portal-primary)] px-5 h-11 text-sm font-semibold hover:bg-white/95 transition"
          >
            <CalendarCheck className="h-4 w-4" />
            {isAr ? "حجز موعد جديد" : "Book appointment"}
          </Link>
        </div>

        {/* Quick stats */}
        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickStat
            icon={<CalendarCheck className="h-4 w-4" />}
            label={isAr ? "مواعيد قادمة" : "Upcoming"}
            value={String(data.upcomingCount)}
          />
          <QuickStat
            icon={<Pill className="h-4 w-4" />}
            label={isAr ? "أدوية نشطة" : "Active meds"}
            value={String(data.activeMedsCount)}
          />
          <QuickStat
            icon={<FlaskConical className="h-4 w-4" />}
            label={isAr ? "نتائج مختبر" : "Lab results"}
            value={String(data.recentLabs.length)}
          />
          <QuickStat
            icon={<Bell className="h-4 w-4" />}
            label={isAr ? "غير مقروء" : "Unread"}
            value={String(data.unreadCount)}
          />
        </div>
      </section>

      {/* Row 1: Upcoming + Health Summary + AI Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming appointments */}
        <div className="portal-card p-5 md:p-6 lg:col-span-2 min-w-0">
          <SectionHeader
            isAr={isAr}
            icon={<CalendarCheck className="h-4 w-4" />}
            title={isAr ? "المواعيد القادمة" : "Upcoming appointments"}
            action={
              <Link
                to="/portal/book"
                className="text-xs font-semibold text-[color:var(--portal-primary)] hover:underline"
              >
                {isAr ? "عرض الكل" : "View all"}
              </Link>
            }
          />
          {data.upcoming.length === 0 ? (
            <EmptyBlock
              isAr={isAr}
              title={isAr ? "لا توجد مواعيد قادمة" : "No upcoming appointments"}
              body={
                isAr
                  ? "ابدأ بحجز موعد جديد مع أحد أطبائنا الاستشاريين."
                  : "Book your next visit with one of our consultants."
              }
              ctaHref="/portal/book"
              ctaLabel={isAr ? "حجز الآن" : "Book now"}
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {data.upcoming.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-[color:var(--portal-gradient-soft)] border border-[color:var(--portal-border)]"
                >
                  <div
                    className="w-14 shrink-0 rounded-xl bg-white grid place-items-center py-2 border border-[color:var(--portal-border)]"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-[color:var(--portal-ink-3)]">
                      {new Date(a.appointment_date).toLocaleDateString(
                        isAr ? "ar-SA-u-nu-latn" : "en-US",
                        { month: "short" },
                      )}
                    </div>
                    <div className="text-lg font-bold text-[color:var(--portal-primary)] leading-none">
                      {new Date(a.appointment_date).getDate()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[color:var(--portal-ink)] truncate">
                      {a.doctor
                        ? isAr
                          ? a.doctor.name_ar
                          : a.doctor.name_en ?? a.doctor.name_ar
                        : isAr
                        ? "طبيب مجمع باعشن"
                        : "Baashen doctor"}
                    </div>
                    <div className="text-[11px] text-[color:var(--portal-ink-3)] truncate">
                      {a.reason ?? (isAr ? "استشارة عامة" : "General consultation")} •{" "}
                      {a.appointment_time?.slice(0, 5)}
                    </div>
                  </div>
                  <StatusBadge status={a.status} isAr={isAr} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI Health Summary */}
        <div
          className="rounded-[24px] p-5 md:p-6 text-white relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,108,189,0.95), rgba(0,184,217,0.9))",
          }}
        >
          <div className="absolute -top-12 -end-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80">
            <Sparkles className="h-4 w-4" /> {isAr ? "ملخص ذكي" : "AI Summary"}
          </div>
          <h3 className="mt-2 text-lg font-bold">
            {isAr ? "لمحة عن حالتك" : "Your health at a glance"}
          </h3>
          <p className="mt-2 text-sm text-white/90 leading-relaxed">
            {data.recentLabs.length > 0
              ? isAr
                ? "نتائج مختبراتك الأخيرة ضمن الحدود الطبيعية عمومًا. حافظ على شرب الماء والنشاط اليومي."
                : "Your latest lab results are broadly within range. Keep up hydration and daily activity."
              : isAr
              ? "لا توجد نتائج مختبرات حديثة. سنولّد ملخصًا كامل بمجرد توفر بياناتك."
              : "No recent labs yet. We'll generate a full summary once your data is available."}
          </p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-full bg-white/15 hover:bg-white/25 px-3 h-9 text-xs font-semibold transition">
              {isAr ? "تحدّث مع المساعد" : "Chat with assistant"}
            </button>
            <Link
              to="/portal/records"
              className="rounded-full bg-white text-[color:var(--portal-primary)] px-3 h-9 inline-flex items-center text-xs font-semibold hover:bg-white/90 transition"
            >
              {isAr ? "السجل الطبي" : "Medical records"}
            </Link>
          </div>
        </div>
      </section>

      {/* Row 2: Recent Labs + Notifications */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="portal-card p-5 md:p-6 lg:col-span-2 min-w-0">
          <SectionHeader
            isAr={isAr}
            icon={<Activity className="h-4 w-4" />}
            title={isAr ? "أحدث نتائج المختبر" : "Recent laboratory results"}
            action={
              <Link
                to="/portal/laboratory"
                className="text-xs font-semibold text-[color:var(--portal-primary)] hover:underline"
              >
                {isAr ? "الكل" : "All"}
              </Link>
            }
          />
          {data.recentLabs.length === 0 ? (
            <EmptyBlock
              isAr={isAr}
              title={isAr ? "لا توجد نتائج بعد" : "No results yet"}
              body={
                isAr
                  ? "ستظهر نتائج مختبرك هنا بمجرد توفرها."
                  : "Your results will appear here once available."
              }
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[color:var(--portal-ink-3)] text-start">
                    <th className={`py-2 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "الفحص" : "Test"}
                    </th>
                    <th className={`py-2 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "القيمة" : "Value"}
                    </th>
                    <th className={`py-2 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "المعدل الطبيعي" : "Range"}
                    </th>
                    <th className={`py-2 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "الحالة" : "Status"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLabs.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-[color:var(--portal-border)] hover:bg-[color:var(--portal-gradient-soft)]"
                    >
                      <td className="py-3 font-medium text-[color:var(--portal-ink)]">
                        {l.test_name}
                      </td>
                      <td className="py-3">
                        {l.value ?? "—"}{" "}
                        <span className="text-[color:var(--portal-ink-3)] text-xs">
                          {l.unit ?? ""}
                        </span>
                      </td>
                      <td className="py-3 text-[color:var(--portal-ink-3)] text-xs">
                        {l.reference_range ?? "—"}
                      </td>
                      <td className="py-3">
                        <LabStatusPill status={l.status} isAr={isAr} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="portal-card p-5 md:p-6 min-w-0">
          <SectionHeader
            isAr={isAr}
            icon={<Bell className="h-4 w-4" />}
            title={isAr ? "الإشعارات" : "Notifications"}
            action={
              <Link
                to="/portal/notifications"
                className="text-xs font-semibold text-[color:var(--portal-primary)] hover:underline"
              >
                {isAr ? "الكل" : "All"}
              </Link>
            }
          />
          {data.notifications.length === 0 ? (
            <EmptyBlock
              isAr={isAr}
              title={isAr ? "لا توجد إشعارات" : "No notifications"}
              body={isAr ? "أنت على اطلاع بكل شيء." : "You're all caught up."}
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {data.notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3">
                  <span
                    className={
                      "mt-1 h-2 w-2 shrink-0 rounded-full " +
                      (n.read_at ? "bg-[color:var(--portal-ink-3)]" : "bg-[color:var(--portal-primary)]")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[color:var(--portal-ink)] truncate">
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-[color:var(--portal-ink-2)] line-clamp-2 mt-0.5">
                        {n.body}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Row 3: Doctors rail */}
      <section className="portal-card p-5 md:p-6">
        <SectionHeader
          isAr={isAr}
          icon={<Stethoscope className="h-4 w-4" />}
          title={isAr ? "أطباؤنا" : "Our doctors"}
          action={
            <Link
              to="/portal/doctors"
              className="text-xs font-semibold text-[color:var(--portal-primary)] hover:underline"
            >
              {isAr ? "استكشاف الأطباء" : "Browse all"}
            </Link>
          }
        />
        {data.doctorsRail.length === 0 ? (
          <EmptyBlock
            isAr={isAr}
            title={isAr ? "قائمة الأطباء غير متاحة" : "Doctors list unavailable"}
            body={isAr ? "سنعرض الأطباء المتاحين قريبًا." : "We'll show available doctors soon."}
          />
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.doctorsRail.slice(0, 6).map((d) => (
              <div
                key={d.id}
                className="portal-card portal-card-hover p-3 text-center flex flex-col items-center"
              >
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt={isAr ? d.name_ar : d.name_en ?? d.name_ar}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full grid place-items-center text-white font-semibold"
                    style={{ background: "var(--portal-gradient)" }}
                  >
                    {(isAr ? d.name_ar : d.name_en ?? d.name_ar)
                      ?.trim()
                      ?.split(/\s+/)
                      ?.slice(0, 2)
                      ?.map((s: string) => s[0])
                      ?.join("")
                      ?.toUpperCase()}
                  </div>
                )}
                <div className="mt-2 text-xs font-semibold text-[color:var(--portal-ink)] leading-tight truncate w-full">
                  {isAr ? d.name_ar : d.name_en ?? d.name_ar}
                </div>
                <div className="text-[10px] text-[color:var(--portal-ink-3)] truncate w-full">
                  {isAr ? d.title_ar ?? "استشاري" : d.title_en ?? "Consultant"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-white/20 grid place-items-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="text-[11px] text-white/80 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({
  isAr,
  icon,
  title,
  action,
}: {
  isAr: boolean;
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 grid place-items-center rounded-xl text-white"
          style={{ background: "var(--portal-gradient)" }}
        >
          {icon}
        </span>
        <h3 className="truncate text-base md:text-lg font-bold text-[color:var(--portal-ink)]">
          {title}
        </h3>
      </div>
      {action}
      {!action &&
        (isAr ? <ChevronLeft className="h-4 w-4 text-[color:var(--portal-ink-3)]" /> : <ChevronRight className="h-4 w-4 text-[color:var(--portal-ink-3)]" />)}
    </div>
  );
}

function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { bg: string; text: string; label_ar: string; label_en: string }> = {
    new: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      label_ar: "جديد",
      label_en: "New",
    },
    confirmed: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      label_ar: "مؤكد",
      label_en: "Confirmed",
    },
    cancelled: { bg: "bg-red-100", text: "text-red-700", label_ar: "ملغى", label_en: "Cancelled" },
    completed: { bg: "bg-slate-100", text: "text-slate-700", label_ar: "منتهي", label_en: "Done" },
  };
  const c = map[status] ?? {
    bg: "bg-slate-100",
    text: "text-slate-700",
    label_ar: status,
    label_en: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[11px] font-semibold ${c.bg} ${c.text}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {isAr ? c.label_ar : c.label_en}
    </span>
  );
}

function LabStatusPill({ status, isAr }: { status: string | null; isAr: boolean }) {
  const s = (status ?? "normal").toLowerCase();
  const map: Record<string, { bg: string; text: string; label_ar: string; label_en: string }> = {
    normal: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      label_ar: "طبيعي",
      label_en: "Normal",
    },
    low: { bg: "bg-blue-100", text: "text-blue-700", label_ar: "منخفض", label_en: "Low" },
    high: { bg: "bg-amber-100", text: "text-amber-700", label_ar: "مرتفع", label_en: "High" },
    critical: { bg: "bg-red-100", text: "text-red-700", label_ar: "حرج", label_en: "Critical" },
  };
  const c = map[s] ?? map.normal;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[11px] font-semibold ${c.bg} ${c.text}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {isAr ? c.label_ar : c.label_en}
    </span>
  );
}

function EmptyBlock({
  isAr,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  isAr: boolean;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--portal-border)] p-6 text-center">
      <div className="text-sm font-semibold text-[color:var(--portal-ink)]">{title}</div>
      <p className="text-xs text-[color:var(--portal-ink-3)] mt-1">{body}</p>
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="mt-3 inline-flex rounded-full px-4 h-9 items-center text-xs font-semibold text-white"
          style={{ background: "var(--portal-gradient)" }}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
