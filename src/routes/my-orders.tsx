import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  Pill,
  Stethoscope,
  Home as HomeIcon,
  Search,
  ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/my-orders")({
  head: () => ({
    meta: [
      { title: "طلباتي | باعشن الطبي" },
      {
        name: "description",
        content: "تتبع مواعيدك، طلبات الصيدلية، الرأي الطبي الثاني والرعاية المنزلية في مكان واحد.",
      },
      { property: "og:title", content: "طلباتي — باعشن الطبي" },
      {
        property: "og:description",
        content: "تتبع جميع طلباتك الطبية برقم الجوال أو رقم الطلب.",
      },
    ],
  }),
  component: MyOrdersHub,
});

type TrackCard = {
  key: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  hintAr: string;
  hintEn: string;
};

const CARDS: TrackCard[] = [
  {
    key: "appointment",
    ar: "المواعيد الطبية",
    en: "Medical Appointments",
    descAr: "تتبع، تعديل أو إلغاء موعدك مع الطبيب.",
    descEn: "Track, reschedule or cancel your appointment.",
    icon: CalendarCheck,
    to: "/lookup",
    hintAr: "برقم الحجز ورقم الجوال",
    hintEn: "By booking ref + phone",
  },
  {
    key: "pharmacy",
    ar: "طلبات الصيدلية",
    en: "Pharmacy Orders",
    descAr: "حالة توصيل الأدوية.",
    descEn: "Medicine delivery status.",
    icon: Pill,
    to: "/track",
    hintAr: "برقم الطلب",
    hintEn: "By order number",
  },
  {
    key: "second-opinion",
    ar: "الرأي الطبي الثاني",
    en: "Second Opinion",
    descAr: "تابع حالة طلب المراجعة.",
    descEn: "Follow up on your review.",
    icon: Stethoscope,
    to: "/second-opinion",
    hintAr: "بالبريد أو رقم الطلب",
    hintEn: "By email or request ref",
  },
  {
    key: "home-care",
    ar: "الرعاية المنزلية",
    en: "Home Care",
    descAr: "حالة زيارتك المنزلية.",
    descEn: "Your home visit status.",
    icon: HomeIcon,
    to: "/home-care",
    hintAr: "برقم الطلب أو الجوال",
    hintEn: "By ref or phone",
  },
];

function MyOrdersHub() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="container-app py-12 md:py-16">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {isAr ? "تتبع الطلبات" : "Track Orders"}
            </div>
            <h1 className="text-4xl md:text-5xl leading-tight">
              {isAr ? "طلباتي في مكان واحد" : "My orders in one place"}
            </h1>
            <p className="mt-3 text-white/85 max-w-2xl">
              {isAr
                ? "اختر نوع الطلب الذي تريد تتبعه — سنطلب منك رقمًا للتحقق قبل عرض التفاصيل."
                : "Pick what you want to track — we'll ask for a reference before showing details."}
            </p>
          </div>
        </div>
      </section>

      {/* Track cards */}
      <section className="py-10 md:py-14">
        <div className="container-app">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.key}
                  to={c.to}
                  className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-md transition-all flex gap-4"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold">{isAr ? c.ar : c.en}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-6">
                      {isAr ? c.descAr : c.descEn}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{isAr ? c.hintAr : c.hintEn}</span>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {isAr ? "ابدأ التتبع" : "Start tracking"}
                      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Signed-in shortcut */}
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "لديك حساب مسجل؟ استعرض كل ملفك الطبي وطلباتك من بوابة المريض."
                : "Have an account? See your full medical file and orders in the patient portal."}
            </p>
            <Link
              to="/my"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 h-10 text-sm font-semibold hover:bg-primary/90"
            >
              {isAr ? "بوابة المريض" : "Patient Portal"}
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
