import { createFileRoute } from "@tanstack/react-router";

const REPO_OWNER = "Baeshen";
const REPO_NAME = "happy-hugger-fluff-9f5e6fc9";
const REPO_FULL = `${REPO_OWNER}/${REPO_NAME}`;
const REPO_URL = `https://github.com/${REPO_FULL}`;
const SYNC_BRANCH = "main";

export const Route = createFileRoute("/settings/github")({
  head: () => ({
    meta: [
      { title: "إعدادات GitHub — Baeshen Medical" },
      { name: "description", content: "معلومات مستودع GitHub المربوط والفرع المستخدم للتزامن." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GitHubSettingsPage,
});

function GitHubSettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-10" dir="rtl">
      <h1 className="text-3xl font-bold mb-2">إعدادات GitHub</h1>
      <p className="text-muted-foreground mb-8">
        معلومات المستودع المربوط بالمشروع والفرع المستخدم للتزامن التلقائي.
      </p>

      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <div className="text-sm text-muted-foreground mb-1">المستودع المربوط</div>
          <div className="font-mono text-lg font-semibold">{REPO_FULL}</div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline mt-1 inline-block"
          >
            فتح المستودع على GitHub ↗
          </a>
        </div>

        <div className="border-t pt-6">
          <div className="text-sm text-muted-foreground mb-1">الفرع المستخدم للتزامن</div>
          <div className="font-mono text-lg font-semibold">
            <span className="inline-block rounded bg-muted px-2 py-1">{SYNC_BRANCH}</span>
          </div>
        </div>

        <div className="border-t pt-6 text-sm text-muted-foreground leading-relaxed">
          <p className="mb-2">
            <strong className="text-foreground">ملاحظة:</strong> هذه القيم مكتوبة يدوياً في الكود.
            لتغييرها، عدّل الملف <code className="font-mono bg-muted px-1 rounded">src/routes/settings.github.tsx</code>.
          </p>
          <p>
            المزامنة بين Lovable و GitHub تدار من إعدادات Lovable الخارجية،
            وليس من داخل التطبيق.
          </p>
        </div>
      </div>
    </div>
  );
}
