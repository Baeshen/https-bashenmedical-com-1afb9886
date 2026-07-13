import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import QRCode from "qrcode";
import { AlertCircle, Bell, Calendar as CalIcon, CalendarPlus, CheckCircle2, ClipboardList, Download, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { downloadBookingConfirmationPdf } from "@/lib/booking-pdf";
import { downloadIcs, googleCalendarUrl, type ShareBooking } from "@/lib/booking-share";
import { formatArDate, type State } from "./types";

export function StepSuccess({
  lang, state, branches, specialties, doctors, reference, phone, onNewBooking,
}: {
  lang: "ar" | "en"; state: State; branches: any[]; specialties: any[]; doctors: any[];
  reference: string | null; phone: string; onNewBooking: () => void;
}) {
  const branch = branches.find((b) => b.id === state.branchId);
  const spec   = specialties.find((s) => s.id === state.specialtyId);
  const doc    = doctors.find((d: any) => d.id === state.doctorId);
  const timeReadable = useMemo(() => {
    if (!state.time) return "—";
    const m = /^(\d{1,2}):(\d{2})/.exec(state.time);
    if (!m) return state.time;
    const h = Number(m[1]);
    const min = m[2];
    const h12 = ((h + 11) % 12) + 1;
    const suffix = lang === "ar" ? (h < 12 ? "صباحًا" : "مساءً") : (h < 12 ? "AM" : "PM");
    return `${h12}:${min} ${suffix} (${String(h).padStart(2, "0")}:${min})`;
  }, [state.time, lang]);

  // Calendar reminder choices — persisted in localStorage so future bookings
  // remember the patient's preference. Falls back to what was chosen in the
  // patient step, then to both enabled.
  const CAL_PREF_KEY = "bm.calReminderPrefs.v1";
  const [cal24h, setCal24h] = useState<boolean>(state.patient.reminder24h !== false);
  const [cal2h, setCal2h] = useState<boolean>(state.patient.reminder2h !== false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CAL_PREF_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { r24?: boolean; r2?: boolean };
      if (typeof p.r24 === "boolean") setCal24h(p.r24);
      if (typeof p.r2 === "boolean") setCal2h(p.r2);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CAL_PREF_KEY, JSON.stringify({ r24: cal24h, r2: cal2h }));
    } catch { /* ignore */ }
  }, [cal24h, cal2h]);

  const rows = [
    { label: lang === "ar" ? "الفرع" : "Branch", value: branch ? (lang === "ar" ? branch.name_ar : branch.name_en) : "—" },
    { label: lang === "ar" ? "التخصص" : "Specialty", value: spec ? (lang === "ar" ? spec.name_ar : spec.name_en) : "—" },
    { label: lang === "ar" ? "الطبيب" : "Doctor", value: doc ? (lang === "ar" ? doc.name_ar : doc.name_en) : "—" },
    { label: lang === "ar" ? "التاريخ" : "Date", value: formatArDate(state.date, lang) },
    { label: lang === "ar" ? "الوقت" : "Time", value: timeReadable },
    { label: lang === "ar" ? "الاسم" : "Name", value: state.patient.name },
    { label: lang === "ar" ? "الجوال" : "Phone", value: phone },
  ];

  async function copyRef() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(lang === "ar" ? "تم نسخ رقم الحجز" : "Reference copied");
    } catch {
      toast.error(lang === "ar" ? "تعذّر النسخ" : "Copy failed");
    }
  }

  const detailsText = useMemo(() => {
    const SEP = "────────────────────────────";
    const header = lang === "ar"
      ? "🏥 تأكيد حجز — مجمع باعشن الطبي"
      : "🏥 Booking confirmation — Baeshen Medical Complex";
    const footer = lang === "ar"
      ? "احتفظ برقم الحجز لأي استفسار."
      : "Keep the reference for any inquiry.";
    const stamp = new Date().toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const labelWidth = Math.max(...rows.map((r) => r.label.length));
    const pad = (s: string) => s + " ".repeat(Math.max(0, labelWidth - s.length));

    const lines: string[] = [];
    lines.push(header);
    lines.push(SEP);
    if (reference) {
      lines.push(`${lang === "ar" ? "رقم الحجز" : "Reference"}: ${reference}`);
      lines.push(SEP);
    }
    for (const r of rows) lines.push(`${pad(r.label)} : ${r.value}`);
    lines.push(SEP);
    lines.push(`${lang === "ar" ? "تاريخ النسخ" : "Copied at"}: ${stamp}`);
    lines.push(footer);
    return lines.join("\n");
  }, [rows, reference, lang]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(detailsText);
      toast.success(lang === "ar" ? "تم نسخ تفاصيل الحجز" : "Booking details copied");
    } catch {
      toast.error(lang === "ar" ? "تعذّر النسخ" : "Copy failed");
    }
  }

  async function copyRow(value: string) {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(lang === "ar" ? "تم النسخ" : "Copied");
    } catch {
      toast.error(lang === "ar" ? "تعذّر النسخ" : "Copy failed");
    }
  }

  const phone4 = (phone.match(/\d/g) ?? []).slice(-4).join("");

  // Tracking URL encoded in the QR + used for the download filename.
  const trackUrl = useMemo(() => {
    if (typeof window === "undefined" || !reference) return "";
    const base = window.location.origin;
    const p = new URLSearchParams({ ref: reference });
    if (phone4) p.set("phone4", phone4);
    return `${base}/track?${p.toString()}`;
  }, [reference, phone4]);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!trackUrl || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, trackUrl, { width: 176, margin: 1, errorCorrectionLevel: "M" })
      .catch(() => {/* noop */});
    QRCode.toDataURL(trackUrl, { width: 512, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [trackUrl]);

  function downloadQr() {
    if (!qrDataUrl || !reference) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `booking-${reference}-qr.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function downloadPdf() {
    if (!reference) return;
    downloadBookingConfirmationPdf({
      reference,
      patient_name: state.patient.name,
      patient_phone: phone,
      appointment_date: state.date ?? "",
      appointment_time: state.time ?? "",
      centerName: branch ? (lang === "ar" ? branch.name_ar : branch.name_en) : undefined,
      specialty: spec ? (lang === "ar" ? spec.name_ar : spec.name_en) : undefined,
      doctor_name: doc ? (lang === "ar" ? doc.name_ar : doc.name_en) : undefined,
      status: lang === "ar" ? "قيد المراجعة" : "Pending review",
    });
  }

  const waMessage = useMemo(() => {
    const header = lang === "ar"
      ? "مرحبًا، لدي حجز في مجمع باعشن الطبي وأحتاج للمساعدة:"
      : "Hello, I have a booking at Baeshen Medical Complex and need assistance:";
    const parts: string[] = [header, ""];
    if (reference) {
      parts.push(`${lang === "ar" ? "رقم الحجز" : "Reference"}: ${reference}`);
    }
    for (const r of rows) parts.push(`${r.label}: ${r.value}`);
    if (trackUrl) parts.push("", `${lang === "ar" ? "رابط التتبع" : "Tracking link"}: ${trackUrl}`);
    return parts.join("\n");
  }, [rows, reference, lang, trackUrl]);
  const waHref = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 grid place-items-center mb-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400"/>
      </div>
      <h2 className="text-2xl md:text-3xl font-bold">
        {lang === "ar" ? "شكرًا لك، تم استلام طلب الحجز بنجاح" : "Thank you — your booking request was received"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "ar"
          ? "سيتواصل معك فريق الاستقبال خلال دقائق لتأكيد الموعد، وسيصلك تذكير عبر واتساب قبل الموعد بيوم. احتفظ برقم الحجز أدناه لأي استفسار أو تعديل."
          : "Our reception team will contact you within minutes to confirm. You'll also receive a WhatsApp reminder one day before your appointment. Keep the reference below for any inquiry or change."}
      </p>

      {reference && (
        <div className="mt-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4">
          <div className="text-xs text-muted-foreground mb-1">
            {lang === "ar" ? "رقم الحجز" : "Booking reference"}
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl md:text-3xl font-mono font-bold tracking-wider text-primary">
              {reference}
            </span>
            <Button variant="outline" size="sm" onClick={copyRef} className="gap-1">
              <ClipboardList className="h-4 w-4"/>
              {lang === "ar" ? "نسخ" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {reference && trackUrl && (
        <div
          data-testid="booking-qr"
          className="mt-6 rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-center gap-4"
        >
          <div className="shrink-0 rounded-lg bg-white p-2 border border-border">
            <canvas ref={qrCanvasRef} width={176} height={176} aria-label={lang === "ar" ? "رمز QR لتتبع الحجز" : "Booking tracking QR"} />
          </div>
          <div className="flex-1 min-w-0 text-start">
            <div className="text-sm font-semibold flex items-center gap-2 justify-center sm:justify-start">
              <QrCode className="h-4 w-4 text-primary" />
              {lang === "ar" ? "امسح للوصول إلى صفحة التتبع" : "Scan to open the tracking page"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground break-all">{trackUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl} className="gap-1">
                <Download className="h-4 w-4" />
                {lang === "ar" ? "تحميل QR" : "Download QR"}
              </Button>
              <Button
                data-testid="booking-pdf-btn"
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                {lang === "ar" ? "تحميل PDF" : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reference && state.date && state.time && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-start">
          <div className="text-sm font-semibold flex items-center gap-2 mb-1">
            <CalendarPlus className="h-4 w-4 text-primary" />
            {lang === "ar" ? "أضف الموعد إلى تقويمك" : "Add to your calendar"}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {lang === "ar"
              ? "اختر التذكيرات التي تريد تضمينها قبل إنشاء الملف أو فتح تقويم Google. سنحفظ اختيارك للمرات القادمة."
              : "Choose reminders to include before generating the file or opening Google Calendar. Your choice is saved for next time."}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={cal24h}
                onChange={(e) => setCal24h(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>{lang === "ar" ? "تذكير قبل 24 ساعة" : "24h before"}</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={cal2h}
                onChange={(e) => setCal2h(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>{lang === "ar" ? "تذكير قبل ساعتين" : "2h before"}</span>
            </label>
          </div>
          {(() => {
            const share: ShareBooking = {
              ref: reference,
              patient_name: state.patient.name,
              patient_phone: phone,
              appointment_date: state.date,
              appointment_time: state.time,
              doctor: doc ? (lang === "ar" ? doc.name_ar : doc.name_en) : null,
              specialty: spec ? (lang === "ar" ? spec.name_ar : spec.name_en) : null,
              reminder_24h: cal24h,
              reminder_2h: cal2h,
            };
            const eventTitle = `${SITE.nameAr}${share.doctor ? " — موعد مع " + share.doctor : " — موعد"}`;
            const previewRows: Array<{ label: string; value: string }> = [
              { label: lang === "ar" ? "عنوان الحدث" : "Event title", value: eventTitle },
              { label: lang === "ar" ? "التاريخ" : "Date", value: formatArDate(state.date, lang) },
              { label: lang === "ar" ? "الوقت" : "Time", value: `${timeReadable} — ${lang === "ar" ? "بتوقيت الرياض" : "Riyadh time"}` },
              { label: lang === "ar" ? "المدة" : "Duration", value: lang === "ar" ? "30 دقيقة" : "30 minutes" },
            ];
            if (share.specialty) previewRows.push({ label: lang === "ar" ? "التخصص" : "Specialty", value: share.specialty });
            if (share.doctor) previewRows.push({ label: lang === "ar" ? "الطبيب" : "Doctor", value: share.doctor });
            previewRows.push({ label: lang === "ar" ? "الموقع" : "Location", value: lang === "ar" ? SITE.addressAr : (SITE.addressEn ?? SITE.addressAr) });
            previewRows.push({ label: lang === "ar" ? "رقم الحجز" : "Reference", value: reference });
            const remindersText = [cal24h ? (lang === "ar" ? "قبل 24 ساعة" : "24h before") : null,
                                   cal2h ? (lang === "ar" ? "قبل ساعتين" : "2h before") : null]
              .filter(Boolean).join(lang === "ar" ? " و" : " & ");
            previewRows.push({
              label: lang === "ar" ? "التذكيرات" : "Reminders",
              value: remindersText || (lang === "ar" ? "بدون تذكيرات" : "None"),
            });
            return (
              <>
                <div className="mb-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                  <div className="mb-2 text-xs font-semibold text-primary">
                    {lang === "ar" ? "معاينة تفاصيل الحدث" : "Event preview"}
                  </div>
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                    {previewRows.map((r) => (
                      <div key={r.label} className="contents">
                        <dt className="text-muted-foreground whitespace-nowrap">{r.label}</dt>
                        <dd className="font-medium break-words">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={googleCalendarUrl(share)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {lang === "ar" ? "أضِف إلى تقويم Google" : "Add to Google Calendar"}
                  </a>
                  <Button variant="outline" size="sm" onClick={() => downloadIcs(share)} className="gap-2">
                    <Download className="h-4 w-4" />
                    {lang === "ar" ? "تحميل ملف .ics" : "Download .ics"}
                  </Button>
                </div>
              </>
            );
          })()}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "ملف .ics يعمل مع Apple Calendar وOutlook وأي تقويم متوافق."
              : "The .ics file works with Apple Calendar, Outlook, and any compatible app."}
          </p>
        </div>
      )}

      {reference && state.date && state.time && (cal24h || cal2h) && (() => {
        const [y, mo, d] = state.date.split("-").map(Number);
        const [h, mi] = state.time.split(":").map(Number);
        // Appointment time is local Asia/Riyadh (UTC+3) — subtract 3h to get UTC.
        const apptUTC = new Date(Date.UTC(y, mo - 1, d, h - 3, mi));
        const fmt = (dt: Date) =>
          dt.toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
            timeZone: "Asia/Riyadh",
          });
        const items: Array<{ offsetMin: number; labelAr: string; labelEn: string; channelsAr: string; channelsEn: string }> = [];
        if (cal24h) items.push({
          offsetMin: 1440,
          labelAr: "قبل 24 ساعة",
          labelEn: "24 hours before",
          channelsAr: "واتساب + إشعار داخل الموقع",
          channelsEn: "WhatsApp + in-app push",
        });
        if (cal2h) items.push({
          offsetMin: 120,
          labelAr: "قبل ساعتين",
          labelEn: "2 hours before",
          channelsAr: "إشعار داخل الموقع",
          channelsEn: "In-app push",
        });
        return (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 text-start">
            <div className="text-sm font-semibold flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-primary" />
              {lang === "ar" ? "معاينة التذكيرات قبل إرسالها" : "Reminder preview"}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {lang === "ar"
                ? "ستُرسَل هذه التذكيرات تلقائيًا في المواعيد المحدّدة أدناه (بتوقيت الرياض)."
                : "These reminders will be sent automatically at the times below (Riyadh time)."}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {items.map((it) => {
                const when = new Date(apptUTC.getTime() - it.offsetMin * 60000);
                const past = when.getTime() < Date.now();
                return (
                  <li key={it.offsetMin} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${past ? "bg-muted-foreground/40" : "bg-emerald-500"}`} />
                      <div>
                        <div className="text-sm font-semibold">
                          {lang === "ar" ? it.labelAr : it.labelEn}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {lang === "ar" ? it.channelsAr : it.channelsEn}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground sm:text-end">
                      {fmt(when)}
                      {past && (
                        <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {lang === "ar" ? "انقضى" : "past"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {lang === "ar"
                ? "يمكنك تعديل تفضيلات التذكير من صفحة إدارة الحجز في أي وقت."
                : "You can change reminder preferences from the manage-booking page anytime."}
            </p>
          </div>
        );
      })()}



      <div className="mt-6 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {lang === "ar" ? "تفاصيل الحجز" : "Booking details"}
        </div>
        <Button variant="ghost" size="sm" onClick={copyAll} className="gap-1 text-primary">
          <ClipboardList className="h-4 w-4"/>
          {lang === "ar" ? "نسخ الكل" : "Copy all"}
        </Button>
      </div>
      <dl className="rounded-xl border border-border divide-y divide-border overflow-hidden text-start">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr,2fr,auto] items-center p-3 text-sm gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium break-words">{r.value}</dd>
            <button
              type="button"
              onClick={() => copyRow(String(r.value ?? ""))}
              aria-label={lang === "ar" ? `نسخ ${r.label}` : `Copy ${r.label}`}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <ClipboardList className="h-3.5 w-3.5"/>
            </button>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/track"
          search={{ ref: reference ?? undefined, phone4: phone4 || undefined } as never}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-bold hover:opacity-90"
        >
          <ClipboardList className="h-4 w-4"/>
          {lang === "ar" ? "متابعة في حجوزاتي" : "Track in my bookings"}
        </Link>
        <Link
          to="/booking-confirmation"
          search={{ ref: reference ?? undefined, phone } as never}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted"
        >
          <CheckCircle2 className="h-4 w-4"/>
          {lang === "ar" ? "عرض التفاصيل الكاملة" : "View full details"}
        </Link>
      </div>

      {reference && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-start">
          <h3 className="text-sm font-bold mb-1">
            {lang === "ar" ? "إدارة الحجز" : "Manage booking"}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {lang === "ar"
              ? "يمكنك تعديل موعدك أو إلغاؤه في أي وقت — سنستخدم رقم الحجز ورقم جوالك للتحقق."
              : "You can reschedule or cancel anytime — we verify via reference and phone."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/lookup"
              search={{ ref: reference, phone, action: "reschedule" } as never}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <CalendarPlus className="h-4 w-4" />
              {lang === "ar" ? "تعديل الموعد" : "Reschedule"}
            </Link>
            <Link
              to="/lookup"
              search={{ ref: reference, phone, action: "cancel" } as never}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <AlertCircle className="h-4 w-4" />
              {lang === "ar" ? "إلغاء الحجز" : "Cancel booking"}
            </Link>
          </div>
        </div>
      )}
      <div className="mt-3">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:bg-[#1ebe5b] transition"
        >
          <MessageCircle className="h-4 w-4"/>
          {lang === "ar" ? "تواصل عبر واتساب بتفاصيل الحجز" : "Contact via WhatsApp with booking details"}
        </a>
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={onNewBooking} className="gap-2 h-auto py-2 w-full">
          <CalIcon className="h-4 w-4"/>
          {lang === "ar" ? "حجز جديد" : "New booking"}
        </Button>
      </div>
    </div>
  );
}
