export const SITE = {
  nameAr: "مجمع باعشن الطبي",
  nameEn: "Baeshen Medical Complex",
  // رقم جوال موحّد للاتصال والواتساب في كل الأقسام
  phone: "+966555088623",
  phoneDisplay: "0555088623",
  mobile: "+966555088623",
  mobileDisplay: "0555088623",
  whatsapp: "966555088623",
  email: "info@BaeshenMedical.sa",
  addressAr: "جازان – صبيا – حي الظبية، طريق الملك عبدالعزيز",
  addressEn: "Jazan – Sabya – Al-Dhabya, King Abdulaziz Rd",
  postalCode: "85287",
  lat: 17.111364,
  lng: 42.654935,
  mapsUrl: "https://www.google.com/maps?q=17.111364,42.654935",
  socialHandle: "bashen_medical",
  instagram: "https://instagram.com/bashen_medical",
  tiktok: "https://tiktok.com/@bashen_medical",
  x: "https://x.com/bashen_medical",
} as const;

/**
 * رابط واتساب موحّد للتواصل مع المجمع مع رسالة ابتدائية اختيارية.
 * يُستخدم في كل الأقسام لضمان اتساق الرقم ومنع التكرار.
 */
export function whatsappUrl(message?: string): string {
  const to = SITE.whatsapp.replace(/\D/g, "");
  if (!message) return `https://wa.me/${to}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/** رابط اتصال هاتفي موحّد. */
export function telUrl(): string {
  return `tel:${SITE.phone}`;
}

export const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
export const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
