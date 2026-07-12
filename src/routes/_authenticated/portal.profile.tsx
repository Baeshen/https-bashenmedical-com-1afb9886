import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const Route = createFileRoute("/_authenticated/portal/profile")({
  head: () => ({
    meta: [
      { title: "الملف الشخصي | بوابة المريض" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title_ar="الملف الشخصي" title_en="Profile" />,
});
