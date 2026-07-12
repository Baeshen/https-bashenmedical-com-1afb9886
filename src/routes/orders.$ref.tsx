/**
 * /orders/$ref — صفحة تفاصيل موحدة لأي طلب غير المواعيد.
 * تتطلب ?phone=…&kind=(pharmacy|second_opinion|home_care) وتستخدم
 * `track_orders_by_phone` للتحقق قبل عرض التفاصيل.
 *
 * الحجوزات (kind=appointment) يتم توجيهها إلى /lookup الذي يحتوي على
 * كل قدرات الإلغاء / إعادة الجدولة / السجل.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Loader2, Pill, Stethoscope, Home as HomeIcon, Clock, MapPin, Phone, User, FileText, ClipboardList, Truck, MessageCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/booking/OrderTimeline";

const search = z.object({
  phone: z.string(),
  kind: z.enum(["appointment", "pharmacy", "second_opinion", "home_care"]).optional(),
});

export const Route = createFileRoute("/orders/$ref")({
  validateSearch: search,
  beforeLoad: ({ params, search }) => {
    if (search.kind === "appointment") {
      throw redirect({ to: "/lookup", search: { ref: params.ref, phone: search.phone } });
    }
  },
  head: () => ({
    meta: [
      { title: "تفاصيل الطلب | مجمع باعشن الطبي" },
      { name: "description", content: "تفاصيل طلبك في مجمع باعشن الطبي." },
      { property: "og:title", content: "تفاصيل الطلب" },
    ],
  }),
  component: OrderDetailPage,
});

type Order = {
  kind: "appointment" | "pharmacy" | "second_opinion" | "home_care";
  id: string;
  reference: string;
  title: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  metadata: Record<string, unknown> | null;
};

const KIND_META = {
  pharmacy:       { ar: "طلب صيدلية",   en: "Pharmacy",       icon: Pill },
  second_opinion: { ar: "رأي طبي ثاني", en: "Second opinion", icon: Stethoscope },
  home_care:      { ar: "رعاية منزلية", en: "Home care",      icon: HomeIcon },
  appointment:    { ar: "موعد",         en: "Appointment",    icon: Stethoscope },
};

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكّد",
  cancelled: "ملغى",
  completed: "مكتمل",
  in_review: "قيد المراجعة",
  answered: "تم الرد",
  closed: "مُغلق",
  in_progress: "قيد التنفيذ",
  ready: "جاهز",
  delivered: "تم التسليم",
};

function fmt(iso: string | null, lang: "ar" | "en") {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

function OrderDetailPage() {
  const { ref } = Route.useParams();
  const { phone } = Route.useSearch();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-detail", ref, phone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_orders_by_phone", { _phone: phone });
      if (error) throw error;
      const list = (data ?? []) as Order[];
      return list.find((o) => o.reference === ref) ?? null;
    },
    staleTime: 15_000,
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container-app py-8 md:py-12 max-w-3xl">
        <Link to="/my-orders" className="mb-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {isAr ? "العودة إلى طلباتي" : "Back to my orders"}
        </Link>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <h1 className="text-xl font-bold text-destructive">
              {isAr ? "لم نجد الطلب" : "Order not found"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAr
                ? "تأكّد من رقم الطلب ورقم الجوال المرتبط به."
                : "Check the reference and phone associated with this order."}
            </p>
            <Link to="/my-orders" className="inline-block mt-4">
              <Button variant="outline">{isAr ? "العودة" : "Back"}</Button>
            </Link>
          </div>
        ) : (
          <OrderDetailCard order={data} phone={phone} isAr={isAr} />
        )}
      </div>
    </div>
  );
}

function OrderDetailCard({ order, phone, isAr }: { order: Order; phone: string; isAr: boolean }) {
  const meta = KIND_META[order.kind];
  const Icon = meta.icon;
  const meta2 = (order.metadata ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">{isAr ? meta.ar : meta.en}</div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{order.title}</h1>
              <div className="mt-1 font-mono text-xs text-muted-foreground">#{order.reference}</div>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-semibold">
            {STATUS_AR[order.status] ?? order.status}
          </span>
        </div>

        <div className="mt-6 grid gap-3 text-sm">
          <Row icon={<Clock className="h-4 w-4" />} label={isAr ? "تاريخ الإنشاء" : "Created"} value={fmt(order.created_at, isAr ? "ar" : "en")} />
          {order.scheduled_at && (
            <Row icon={<Clock className="h-4 w-4" />} label={isAr ? "الموعد المفضّل" : "Scheduled"} value={fmt(order.scheduled_at, isAr ? "ar" : "en")} />
          )}
          <Row icon={<Phone className="h-4 w-4" />} label={isAr ? "الجوال" : "Phone"} value={phone} />
          {typeof meta2.address === "string" && meta2.address && (
            <Row icon={<MapPin className="h-4 w-4" />} label={isAr ? "العنوان" : "Address"} value={meta2.address} />
          )}
          {typeof meta2.district === "string" && meta2.district && (
            <Row icon={<MapPin className="h-4 w-4" />} label={isAr ? "الحي" : "District"} value={meta2.district} />
          )}
          {typeof meta2.delivery_type === "string" && (
            <Row icon={<User className="h-4 w-4" />} label={isAr ? "نوع الاستلام" : "Delivery"} value={meta2.delivery_type} />
          )}
          {typeof meta2.email === "string" && meta2.email && (
            <Row icon={<User className="h-4 w-4" />} label={isAr ? "البريد" : "Email"} value={meta2.email} />
          )}
          {typeof meta2.notes === "string" && meta2.notes && (
            <div className="mt-2 rounded-xl bg-muted/50 p-3 text-sm">
              <div className="font-semibold mb-1">{isAr ? "ملاحظات" : "Notes"}</div>
              <p className="text-muted-foreground whitespace-pre-line">{meta2.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-bold mb-2">{isAr ? "هل تحتاج تعديلًا؟" : "Need changes?"}</h3>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "للتعديل أو الاستفسار عن هذا الطلب، تواصل مع الاستقبال."
            : "To modify or ask about this request, please contact reception."}
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Link to="/contact"><Button variant="premium">{isAr ? "تواصل معنا" : "Contact us"}</Button></Link>
          <Link to="/my-orders"><Button variant="outline">{isAr ? "كل طلباتي" : "All my orders"}</Button></Link>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground min-w-24">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
