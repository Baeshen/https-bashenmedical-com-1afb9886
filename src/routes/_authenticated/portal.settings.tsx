import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="الإعدادات" title_en="Settings" />,
});
