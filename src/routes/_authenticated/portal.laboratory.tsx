import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/laboratory")({
  head: () => ({
    meta: [
      { title: "نتائج المختبر | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="نتائج المختبر" title_en="Laboratory Results" />,
});
