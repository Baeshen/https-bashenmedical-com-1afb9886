import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft } from "lucide-react";

export function ComingSoon({
  title_ar,
  title_en,
  description_ar,
  description_en,
}: {
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="portal-card p-8 md:p-12 text-center">
        <div
          className="mx-auto h-14 w-14 rounded-2xl grid place-items-center text-white portal-float"
          style={{ background: "var(--portal-gradient)" }}
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl md:text-3xl font-bold text-[color:var(--portal-ink)]">
          {title_ar}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--portal-ink-3)]">{title_en}</p>
        <p className="mt-4 text-sm md:text-base text-[color:var(--portal-ink-2)] max-w-md mx-auto">
          {description_ar ?? "هذه الصفحة قيد التطوير وستكون متاحة قريبًا داخل البوابة."}
        </p>
        {description_en && (
          <p className="mt-1 text-xs text-[color:var(--portal-ink-3)]">{description_en}</p>
        )}
        <Link
          to="/portal"
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 h-10 text-sm font-semibold text-white"
          style={{ background: "var(--portal-gradient)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          العودة إلى الرئيسية
        </Link>
      </div>
    </div>
  );
}
