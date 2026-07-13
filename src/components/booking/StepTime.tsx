import { useMemo } from "react";
import { Loader2, Sun, CloudSun, Moon, Zap, Clock } from "lucide-react";
import { StepShell } from "./StepShell";
import type { AvailResp } from "./types";

export function StepTime({ lang, value, avail, onPick }: { lang: "ar" | "en"; value: string | null; avail: AvailResp | undefined; onPick: (v: string) => void }) {
  const times = avail?.times ?? [];
  const booked = new Set(avail?.booked ?? []);
  const groups = useMemo(() => {
    const morning: string[] = [], afternoon: string[] = [], evening: string[] = [];
    for (const t of times) {
      const h = parseInt(t.slice(0, 2), 10);
      if (h < 12) morning.push(t);
      else if (h < 17) afternoon.push(t);
      else evening.push(t);
    }
    return { morning, afternoon, evening };
  }, [times]);

  // First available (not booked) slot — offered as a one-tap suggestion.
  const earliest = useMemo(() => times.find((t) => !booked.has(t)) ?? null, [times, booked]);

  if (!avail) return (
    <StepShell lang={lang} title={lang === "ar" ? "اختر الوقت" : "Choose time"}>
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2"/>
        {lang === "ar" ? "جارٍ تحميل المواعيد…" : "Loading slots…"}
      </div>
    </StepShell>
  );

  if (times.length === 0 && booked.size === 0) return (
    <StepShell lang={lang} title={lang === "ar" ? "اختر الوقت" : "Choose time"}>
      <p className="text-center text-muted-foreground py-10">
        {lang === "ar" ? "لا توجد مواعيد متاحة في هذا اليوم — اختر تاريخًا آخر." : "No slots for this date — pick another day."}
      </p>
    </StepShell>
  );

  const renderGroup = (label_ar: string, label_en: string, items: string[], Icon: typeof Sun) => items.length > 0 && (
    <div>
      <h4 className="font-semibold text-sm mb-2 text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-4 w-4"/>
        {lang === "ar" ? label_ar : label_en}
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {items.map((t) => {
          const active = value === t;
          const isBooked = booked.has(t);
          return (
            <button
              key={t}
              disabled={isBooked}
              onClick={() => onPick(t)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-primary text-primary-foreground shadow"
                : isBooked ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                : "bg-muted hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <StepShell lang={lang} title={lang === "ar" ? "اختر الوقت" : "Choose time"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5"/>
          {lang === "ar" ? "بتوقيت الرياض (Asia/Riyadh)" : "Riyadh time (Asia/Riyadh)"}
        </span>
        {earliest && earliest !== value && (
          <button
            type="button"
            onClick={() => onPick(earliest)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 font-semibold transition"
          >
            <Zap className="h-3.5 w-3.5"/>
            {lang === "ar" ? `أقرب موعد متاح: ${earliest}` : `Earliest: ${earliest}`}
          </button>
        )}
      </div>
      <div className="space-y-5">
        {renderGroup("صباحًا", "Morning", groups.morning, Sun)}
        {renderGroup("عصرًا", "Afternoon", groups.afternoon, CloudSun)}
        {renderGroup("مساءً", "Evening", groups.evening, Moon)}
      </div>
    </StepShell>
  );
}
