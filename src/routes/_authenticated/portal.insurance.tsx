import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/insurance")({
  head: () => ({
    meta: [
      { title: "التأمين | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="التأمين" title_en="Insurance" />,
});
