/**
 * أدوات تاريخ/وقت موحّدة لتوقيت الرياض (Asia/Riyadh, UTC+3, بلا صيفي).
 *
 * لماذا هذا الملف؟ الواجهة والحجز يعرضان الوقت بتوقيت الرياض دائماً، لكن
 * `new Date().toISOString().slice(0, 10)` يُرجع اليوم بتوقيت UTC — ما يخلق
 * فرقاً ثلاث ساعات قرب منتصف الليل يسمح/يمنع الإلغاء والفلترة بشكل خاطئ.
 *
 * كل نقطة تقارن تاريخ موعد بـ"اليوم" يجب أن تمرّ عبر `riyadhTodayIso()`.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** اليوم الحالي بتوقيت الرياض بصيغة `YYYY-MM-DD`. */
export function riyadhTodayIso(): string {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

/** الوقت الحالي بالدقائق منذ منتصف الليل بتوقيت الرياض. */
export function riyadhNowMinutes(): number {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}
