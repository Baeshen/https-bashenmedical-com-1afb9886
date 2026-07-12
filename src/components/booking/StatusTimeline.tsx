import { useI18n } from "@/lib/i18n";

type StepState = "done" | "current" | "pending" | "cancelled";
type Step = { key: string; label: string; date: string | null; state: StepState };

function fmtDateTime(iso: string, lang: "ar" | "en") {
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function StatusTimeline({
  status,
  createdAt,
  apptDate,
  apptTime,
}: {
  status: string;
  createdAt: string;
  apptDate: string;
  apptTime: string;
}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const apptIso = `${apptDate}T${apptTime}`;
  const apptDone = new Date(apptIso).getTime() <= Date.now();

  const L = {
    received: isAr ? "تم استلام الحجز" : "Booking received",
    confirmed: isAr ? "تأكيد الموعد" : "Confirmed",
    visit: isAr ? "موعد الزيارة" : "Visit time",
    completed: isAr ? "اكتمال الزيارة" : "Completed",
    cancelled: isAr ? "تم إلغاء الحجز" : "Cancelled",
    title: isAr ? "مراحل الحجز" : "Booking timeline",
    current: isAr ? "الحالة الحالية" : "Current",
  };

  const steps: Step[] = (() => {
    if (status === "cancelled") {
      return [
        { key: "received", label: L.received, date: fmtDateTime(createdAt, lang), state: "done" },
        { key: "cancelled", label: L.cancelled, date: null, state: "cancelled" },
      ];
    }
    const reachedConfirmed = ["confirmed", "completed", "no_show"].includes(status);
    const isCompleted = status === "completed";
    const isNoShow = status === "no_show";
    return [
      { key: "received", label: L.received, date: fmtDateTime(createdAt, lang), state: "done" },
      {
        key: "confirmed",
        label: L.confirmed,
        date: null,
        state: reachedConfirmed ? "done" : status === "new" ? "current" : "pending",
      },
      {
        key: "visit",
        label: L.visit,
        date: fmtDateTime(apptIso, lang),
        state: isCompleted ? "done" : isNoShow ? "cancelled" : apptDone || reachedConfirmed ? "current" : "pending",
      },
      {
        key: "completed",
        label: L.completed,
        date: null,
        state: isCompleted ? "done" : isNoShow ? "cancelled" : "pending",
      },
    ];
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 text-sm font-semibold">{L.title}</div>
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
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${dot}`}
              >
                {s.state === "done" ? "✓" : s.state === "cancelled" ? "✕" : i + 1}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className={`text-sm font-semibold ${s.state === "pending" ? "text-muted-foreground" : ""}`}>
                  {s.label}
                </div>
                {s.date && <div className="mt-0.5 text-xs text-muted-foreground">{s.date}</div>}
                {s.state === "current" && (
                  <div className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {L.current}
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
