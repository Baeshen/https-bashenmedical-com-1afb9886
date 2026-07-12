import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/records")({
  head: () => ({
    meta: [
      { title: "السجل الطبي | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="السجل الطبي" title_en="Medical Records" />,
});
