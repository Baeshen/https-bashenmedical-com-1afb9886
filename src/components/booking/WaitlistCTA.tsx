/**
 * WaitlistCTA — inline card on the booking wizard's time step.
 *
 * When the patient reaches step 6 and no slots fit their needs, they can
 * open this form to register on the doctor's waitlist. The server persists
 * the entry to `appointment_waitlist`, and a Postgres trigger promotes
 * the earliest waiting entry to `notified` whenever a matching appointment
 * is cancelled or no-shown.
 *
 * `emphasized` should be `true` when we already know the whole coming week
 * has no availability — the card is expanded by default in that case.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Bell, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WaitlistCTA({
  lang, doctorId, specialtyId, branchId, defaultName, defaultPhone, emphasized,
}: {
  lang: "ar" | "en";
  doctorId: string | null;
  specialtyId: string | null;
  branchId: string | null;
  defaultName?: string;
  defaultPhone?: string;
  emphasized?: boolean;
}) {
  const [open, setOpen] = useState(!!emphasized);
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string; duplicate?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId) return;
    setError(null); setSubmitting(true);
    try {
      const res = await fetch("/api/public/book/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: name.trim(),
          patient_phone: phone.trim(),
          doctor_id: doctorId,
          specialty_id: specialtyId,
          branch_id: branchId,
          preferred_from: from,
          preferred_to: to,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? (lang === "ar" ? "تعذّر التسجيل" : "Could not register"));
      } else {
        setResult({ reference: json.reference, duplicate: json.duplicate });
        toast.success(lang === "ar" ? "تم تسجيلك في قائمة الانتظار" : "Added to waitlist");
      }
    } catch {
      setError(lang === "ar" ? "تعذّر الاتصال. حاول لاحقًا." : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!doctorId) return null;

  if (result) {
    const phone4 = (phone.match(/\d/g) ?? []).slice(-4).join("");
    return (
      <div className={`rounded-xl border p-4 md:p-5 ${emphasized ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
        <div className="flex items-center gap-2 text-emerald-700 font-semibold">
          <Bell className="h-4 w-4" />
          {lang === "ar" ? "تم تسجيلك في قائمة الانتظار" : "You're on the waitlist"}
        </div>
        <p className="mt-2 text-sm">
          {lang === "ar"
            ? "سنُعلمك فور شغور فتحة. احتفظ برقم الطلب لمتابعة الحالة:"
            : "We'll notify you the moment a slot opens up. Save this reference:"}
        </p>
        <div className="mt-2 text-lg font-mono font-bold tracking-wider">{result.reference}</div>
        <Link
          to="/waitlist"
          search={{ ref: result.reference, phone4 } as never}
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {lang === "ar" ? "عرض حالة الطلب" : "View status"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 md:p-5 ${emphasized ? "border-primary bg-primary/5" : "border-dashed border-border bg-muted/30"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-start"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Bell className="h-4 w-4 text-primary" />
          {emphasized
            ? (lang === "ar" ? "لا توجد مواعيد شاغرة هذا الأسبوع — انضم لقائمة الانتظار" : "No slots this week — join the waitlist")
            : (lang === "ar" ? "لم تجد وقتًا مناسبًا؟ سجّل في قائمة الانتظار" : "No time works? Join the waitlist")}
        </span>
        <ChevronRight className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wl-name">{lang === "ar" ? "الاسم" : "Name"}</Label>
              <Input id="wl-name" required minLength={2} value={name}
                onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="wl-phone">{lang === "ar" ? "رقم الجوال" : "Phone"}</Label>
              <Input id="wl-phone" required inputMode="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="wl-notes">{lang === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Textarea id="wl-notes" rows={2} value={notes} maxLength={500}
              onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? `نطاق البحث الافتراضي: ${from} → ${to}. سنعتمد أول شاغر يظهر خلاله.`
              : `Default range: ${from} → ${to}. We'll notify you of the first opening in this window.`}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "ar" ? "تسجيل في قائمة الانتظار" : "Join waitlist"}
          </Button>
        </form>
      )}
    </div>
  );
}
