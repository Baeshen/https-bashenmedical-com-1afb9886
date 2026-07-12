/**
 * OrderTimeline — Timeline موحّدة لجميع أنواع الطلبات (صيدلية / رأي طبي ثاني /
 * رعاية منزلية / موعد). تشتق الخطوات من نوع الطلب وحالته.
 */
import { useI18n } from "@/lib/i18n";

type OrderKind = "appointment" | "pharmacy" | "second_opinion" | "home_care";
type StepState = "done" | "current" | "pending" | "cancelled";
type Step = { key: string; label: string; date: string | null; state: StepState };

function fmt(iso: string | null, lang: "ar" | "en") {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * تعريف مراحل كل نوع طلب مع الحالة التي تُعتبر عندها كل خطوة "مكتملة".
 * الترتيب مهم — الخطوة قبل الحالة الحالية = done، وبعدها = pending.
 */
const FLOWS: Record<
  OrderKind,
  { key: string; ar: string; en: string; reachedAt: string[] }[]
> = {
  appointment: [
    { key: "received",  ar: "تم استلام الحجز", en: "Booking received", reachedAt: ["new", "confirmed", "completed", "no_show"] },
    { key: "confirmed", ar: "تأكيد الموعد",    en: "Confirmed",        reachedAt: ["confirmed", "completed", "no_show"] },
    { key: "visit",     ar: "موعد الزيارة",     en: "Visit",            reachedAt: ["completed", "no_show"] },
    { key: "completed", ar: "اكتمال الزيارة",   en: "Completed",        reachedAt: ["completed"] },
  ],
  pharmacy: [
    { key: "received",   ar: "تم استلام الطلب",  en: "Order received",  reachedAt: ["new", "processing", "ready", "delivered", "completed"] },
    { key: "processing", ar: "قيد التجهيز",       en: "Processing",      reachedAt: ["processing", "ready", "delivered", "completed"] },
    { key: "ready",      ar: "جاهز للتسليم",      en: "Ready",           reachedAt: ["ready", "delivered", "completed"] },
    { key: "delivered",  ar: "تم التسليم",         en: "Delivered",       reachedAt: ["delivered", "completed"] },
  ],
  second_opinion: [
    { key: "received",  ar: "تم استلام الطلب",   en: "Request received", reachedAt: ["new", "in_review", "answered", "closed", "completed"] },
    { key: "in_review", ar: "قيد المراجعة",      en: "Under review",     reachedAt: ["in_review", "answered", "closed", "completed"] },
    { key: "answered",  ar: "تم إعداد الرأي",    en: "Opinion ready",    reachedAt: ["answered", "closed", "completed"] },
    { key: "closed",    ar: "تم إغلاق الطلب",     en: "Closed",           reachedAt: ["closed", "completed"] },
  ],
  home_care: [
    { key: "received",    ar: "تم استلام الطلب",  en: "Request received", reachedAt: ["new", "confirmed", "in_progress", "completed"] },
    { key: "confirmed",   ar: "تم التأكيد",        en: "Confirmed",        reachedAt: ["confirmed", "in_progress", "completed"] },
    { key: "in_progress", ar: "قيد التنفيذ",       en: "In progress",      reachedAt: ["in_progress", "completed"] },
    { key: "completed",   ar: "اكتملت الخدمة",     en: "Completed",        reachedAt: ["completed"] },
  ],
};

const CANCELLED_STATES = new Set(["cancelled", "rejected", "canceled"]);

export function OrderTimeline({
  kind,
  status,
  createdAt,
  scheduledAt,
}: {
  kind: OrderKind;
  status: string;
  createdAt: string;
  scheduledAt?: string | null;
}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const flow = FLOWS[kind];

  const steps: Step[] = (() => {
    if (CANCELLED_STATES.has(status)) {
      return [
        { key: "received", label: isAr ? "تم استلام الطلب" : "Received", date: fmt(createdAt, lang), state: "done" },
        { key: "cancelled", label: isAr ? "تم إلغاء الطلب" : "Cancelled", date: null, state: "cancelled" },
      ];
    }
    // Find the index of the last step reached by current status
    let currentIdx = 0;
    for (let i = 0; i < flow.length; i++) {
      if (flow[i].reachedAt.includes(status)) currentIdx = i;
    }
    return flow.map((s, i) => {
      let state: StepState;
      if (i < currentIdx) state = "done";
      else if (i === currentIdx) state = s.reachedAt.includes(status) ? (i === flow.length - 1 && status === flow[flow.length - 1].reachedAt.slice(-1)[0] ? "done" : "current") : "current";
      else state = "pending";
      // first step is always done once the record exists
      if (i === 0) state = "done";
      const date =
        i === 0
          ? fmt(createdAt, lang)
          : s.key === "visit" || s.key === "in_progress"
          ? fmt(scheduledAt ?? null, lang)
          : null;
      return { key: s.key, label: isAr ? s.ar : s.en, date, state };
    });
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 text-sm font-semibold">
        {isAr ? "مراحل الطلب" : "Order timeline"}
      </div>
      <ol className="relative">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const dot =
            s.state === "done"
              ? "bg-green-500 border-green-500 text-white"
              : s.state === "current"
              ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
              : s.state === "cancelled"
              ? "bg-destructive border-destructive text-destructive-foreground"
              : "bg-background border-border text-muted-foreground";
          const line =
            s.state === "done" ? "bg-green-500" : s.state === "cancelled" ? "bg-destructive" : "bg-border";
          return (
            <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute top-8 bottom-0 w-0.5 ${line}`}
                  style={{ insetInlineStart: "0.9375rem" }}
                  aria-hidden
                />
              )}
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${dot}`}>
                {s.state === "done" ? "✓" : s.state === "cancelled" ? "✕" : i + 1}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className={`text-sm font-semibold ${s.state === "pending" ? "text-muted-foreground" : ""}`}>
                  {s.label}
                </div>
                {s.date && <div className="mt-0.5 text-xs text-muted-foreground">{s.date}</div>}
                {s.state === "current" && (
                  <div className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {isAr ? "الحالة الحالية" : "Current"}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
