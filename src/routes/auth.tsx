import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { z } from "zod";
import { logAuthEvent } from "@/lib/auth-log.functions";
import {
  Mail,
  Lock,
  User as UserIcon,
  Fingerprint,
  ScanFace,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Phone,
  KeyRound,
  ArrowRight,
} from "lucide-react";

// Normalize a Saudi phone input to E.164 (+9665XXXXXXXX).
// Accepts: 05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX
function normalizeSaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let n = digits;
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (n.startsWith("+9665") && n.length === 13) return n;
  if (n.startsWith("9665") && n.length === 12) return "+" + n;
  if (n.startsWith("05") && n.length === 10) return "+966" + n.slice(1);
  if (n.startsWith("5") && n.length === 9) return "+966" + n;
  return null;
}

const search = z.object({ redirect: z.string().optional() });

function safeLog(input: {
  action: "login_success" | "login_failed" | "logout" | "signup_success" | "signup_failed";
  user_id?: string | null;
  email?: string | null;
  metadata?: Record<string, any> | null;
}) {
  (logAuthEvent as any)({ data: input }).catch(() => {});
}

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | مجمع باعشن الطبي" },
      {
        name: "description",
        content: "بوابة المريض في مجمع باعشن الطبي — سجل دخولك بأمان لإدارة مواعيدك وسجلاتك الطبية.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

async function resolveDefaultDestination(userId: string): Promise<string> {
  // Staff go to /admin; patients go to /portal
  try {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as any,
    });
    if (data === true) return "/admin";
  } catch {
    /* ignore */
  }
  try {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "reception" as any,
    });
    if (data === true) return "/admin";
  } catch {
    /* ignore */
  }
  return "/portal";
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);

  function safeRedirectTarget(): string | null {
    if (!redirect) return null;
    if (!redirect.startsWith("/") || redirect.startsWith("//")) return null;
    return redirect;
  }

  async function goToDestination(userId?: string | null) {
    const explicit = safeRedirectTarget();
    if (explicit) {
      if (explicit.includes("?") || explicit.startsWith("/.")) {
        window.location.assign(explicit);
      } else {
        navigate({ to: explicit });
      }
      return;
    }
    const target = userId ? await resolveDefaultDestination(userId) : "/portal";
    navigate({ to: target });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) goToDestination(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") goToDestination(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const target = safeRedirectTarget() ?? "/portal";
        const { data: signup, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + target,
            data: { full_name: fullName },
          },
        });
        if (error) {
          safeLog({ action: "signup_failed", email, metadata: { error: error.message } });
          throw error;
        }
        safeLog({ action: "signup_success", email, user_id: signup.user?.id ?? null });
        toast.success("تم إنشاء الحساب. تحقق من بريدك الإلكتروني إن لزم.");
      } else {
        const { data: signin, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          safeLog({ action: "login_failed", email, metadata: { error: error.message } });
          throw error;
        }
        safeLog({ action: "login_success", email, user_id: signin.user?.id ?? null });
        toast.success("مرحبًا بعودتك");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setOauthLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error(
          (result.error as any)?.message ??
            (provider === "apple"
              ? "تسجيل الدخول عبر Apple غير متاح حاليًا."
              : "تعذر تسجيل الدخول عبر Google"),
        );
        setOauthLoading(null);
      }
      // On success the OAuth flow either redirects the browser
      // or the tokens are set — onAuthStateChange handles navigation.
    } catch (err: any) {
      toast.error(err?.message ?? "حدث خطأ في تسجيل الدخول");
      setOauthLoading(null);
    }
  }

  return (
    <div dir="rtl" className="portal-root portal-gradient-bg min-h-dvh flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Decorative floating medical motifs */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -end-40 w-[500px] h-[500px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #34C8FF 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -start-40 w-[500px] h-[500px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #0F6CBD 0%, transparent 70%)" }}
        />
        <svg className="absolute top-10 start-10 w-24 h-24 opacity-10 portal-float" viewBox="0 0 100 200" fill="none" stroke="#0F6CBD" strokeWidth="1.5">
          <path d="M20 0 Q50 25 80 50 Q50 75 20 100 Q50 125 80 150 Q50 175 20 200" />
          <path d="M80 0 Q50 25 20 50 Q50 75 80 100 Q50 125 20 150 Q50 175 80 200" />
        </svg>
      </div>

      <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-8 max-w-6xl w-full items-center">
        {/* Left: brand + illustration */}
        <div className="hidden lg:block text-[color:var(--portal-ink)] space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-lg"
              style={{ background: "var(--portal-gradient)" }}
            >
              ب
            </div>
            <div>
              <div className="text-lg font-bold">مجمع باعشن الطبي</div>
              <div className="text-xs text-[color:var(--portal-ink-3)] uppercase tracking-wide">
                Baashen Medical Complex
              </div>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
            رعايتك الصحية
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--portal-gradient)" }}
            >
              بلمسة واحدة.
            </span>
          </h1>
          <p className="text-base text-[color:var(--portal-ink-2)] max-w-md leading-relaxed">
            إدارة مواعيدك، الاطلاع على سجلاتك الطبية، طلب الاستشارات، ومتابعة نتائج المختبر والأشعة — كل ذلك من مكان واحد.
          </p>

          <ul className="space-y-3 text-sm text-[color:var(--portal-ink-2)]">
            {[
              "حجز فوري مع استشاريين معتمدين",
              "نتائج مختبر وأشعة برسوم بيانية سهلة",
              "تذكيرات ذكية وإشعارات مباشرة",
              "مساعد صحي مدعوم بالذكاء الاصطناعي",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded-full grid place-items-center text-white text-[10px]"
                  style={{ background: "var(--portal-gradient)" }}
                >
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: glass card */}
        <div className="glass-card p-6 md:p-8">
          <div className="text-center">
            <div className="lg:hidden mx-auto mb-3 h-14 w-14 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-lg" style={{ background: "var(--portal-gradient)" }}>
              ب
            </div>
            <h2 className="text-2xl font-bold text-[color:var(--portal-ink)]">
              {mode === "signin" ? "أهلًا بعودتك" : "أنشئ حسابك"}
            </h2>
            <p className="text-sm text-[color:var(--portal-ink-3)] mt-1">
              {mode === "signin"
                ? "سجّل الدخول للوصول إلى بوابتك الصحية"
                : "خطوات بسيطة لبدء تجربتك الصحية"}
            </p>
          </div>

          {/* Social buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={!!oauthLoading}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-2xl border border-[color:var(--portal-border)] bg-white text-sm font-medium text-[color:var(--portal-ink)] hover:bg-[color:var(--portal-gradient-soft)] transition disabled:opacity-60"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={!!oauthLoading}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-2xl bg-black text-white text-sm font-medium hover:bg-black/90 transition disabled:opacity-60"
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AppleIcon />
              )}
              Apple
            </button>
          </div>

          {/* Biometric row (visual only in Phase 1) */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => toast.info("تسجيل الدخول بالبصمة قيد التطوير")}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-2xl border border-[color:var(--portal-border)] bg-white/60 backdrop-blur text-sm font-medium text-[color:var(--portal-ink-2)] hover:bg-white transition"
            >
              <Fingerprint className="h-4 w-4" /> البصمة
            </button>
            <button
              type="button"
              onClick={() => toast.info("Face ID قيد التطوير")}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-2xl border border-[color:var(--portal-border)] bg-white/60 backdrop-blur text-sm font-medium text-[color:var(--portal-ink-2)] hover:bg-white transition"
            >
              <ScanFace className="h-4 w-4" /> Face ID
            </button>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-[color:var(--portal-border)]" />
            <span className="text-[11px] uppercase tracking-wider text-[color:var(--portal-ink-3)]">
              أو استخدم بريدك
            </span>
            <div className="flex-1 h-px bg-[color:var(--portal-border)]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field
                icon={<UserIcon className="h-4 w-4" />}
                label="الاسم الكامل"
                type="text"
                value={fullName}
                onChange={setFullName}
                required
              />
            )}
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="البريد الإلكتروني أو الهوية الوطنية"
              type="email"
              value={email}
              onChange={setEmail}
              required
              dir="ltr"
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[color:var(--portal-ink-2)]">
                كلمة المرور
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 grid place-items-center text-[color:var(--portal-ink-3)]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full h-11 rounded-2xl border border-[color:var(--portal-border)] bg-white ps-10 pe-10 text-sm outline-none focus:border-[color:var(--portal-primary)] focus:ring-2 focus:ring-[color:var(--portal-primary)]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 end-2 grid place-items-center text-[color:var(--portal-ink-3)] hover:text-[color:var(--portal-primary)] w-8"
                  aria-label={showPass ? "إخفاء" : "إظهار"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "signin" && (
              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-[color:var(--portal-ink-2)] select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-[color:var(--portal-border)] text-[color:var(--portal-primary)] focus:ring-[color:var(--portal-primary)]/30"
                  />
                  تذكرني
                </label>
                <button
                  type="button"
                  onClick={() => toast.info("إعادة تعيين كلمة المرور — قريبًا")}
                  className="font-semibold text-[color:var(--portal-primary)] hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(15,108,189,0.55)] hover:shadow-[0_14px_40px_-10px_rgba(15,108,189,0.7)] disabled:opacity-60 transition inline-flex items-center justify-center gap-2"
              style={{ background: "var(--portal-gradient)" }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {mode === "signin" ? "دخول" : "إنشاء حساب"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-[color:var(--portal-ink-3)]">
            {mode === "signin" ? (
              <>
                ليس لديك حساب؟{" "}
                <button
                  className="text-[color:var(--portal-primary)] font-semibold hover:underline"
                  onClick={() => setMode("signup")}
                >
                  أنشئ حسابًا
                </button>
              </>
            ) : (
              <>
                لديك حساب؟{" "}
                <button
                  className="text-[color:var(--portal-primary)] font-semibold hover:underline"
                  onClick={() => setMode("signin")}
                >
                  سجّل الدخول
                </button>
              </>
            )}
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-xs text-[color:var(--portal-ink-3)] hover:text-[color:var(--portal-primary)]"
            >
              ← العودة للموقع الرئيسي
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Small components --------------------------- */

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  required,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[color:var(--portal-ink-2)]">
        {label}
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 start-3 grid place-items-center text-[color:var(--portal-ink-3)]">
          {icon}
        </span>
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          className="w-full h-11 rounded-2xl border border-[color:var(--portal-border)] bg-white ps-10 pe-3 text-sm outline-none focus:border-[color:var(--portal-primary)] focus:ring-2 focus:ring-[color:var(--portal-primary)]/20 transition"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.68l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.85 0-5.27-1.92-6.14-4.51H2.18v2.83C4 20.99 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.86 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.68-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 4 3.01 2.18 6.05l3.68 2.83C6.73 6.29 9.15 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.52-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
