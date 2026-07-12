import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="الفواتير" title_en="Invoices" />,
});
