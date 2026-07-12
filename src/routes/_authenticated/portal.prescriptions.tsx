import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/prescriptions")({
  head: () => ({
    meta: [
      { title: "الوصفات الطبية | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="الوصفات الطبية" title_en="Prescriptions" />,
});
