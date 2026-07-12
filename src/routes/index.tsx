import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QuickBar } from "@/components/QuickBar";
import { SITE } from "@/lib/site";
import { Stethoscope } from "lucide-react";
import { buildLocalBusinessSchema } from "@/lib/localBusinessSchema";
import { clinicSettingsQuery, type ClinicSettings } from "@/lib/clinicSettings";
import { StatsBar } from "@/components/home/StatsBar";
import { AwardsMarquee } from "@/components/home/AwardsMarquee";
import { HeroComplex } from "@/components/home/HeroComplex";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { ServicesBento } from "@/components/home/ServicesBento";
import { CentersStrip } from "@/components/home/CentersStrip";
import { PatientJourney } from "@/components/home/PatientJourney";
import { NewsStrip } from "@/components/home/NewsStrip";
import { AppPromo } from "@/components/home/AppPromo";
import { StaggerReveal, RevealItem } from "@/components/motion/StaggerReveal";
import ogHomeAsset from "@/assets/og-home.jpg.asset.json";

const HOME_URL = "https://bashenmedical.com/";
const HOME_TITLE =
  "مجمع باعشن الطبي بصبيا جازان — حجز أطباء استشاريين وصيدلية | Baeshen Medical";
const HOME_DESC =
  "مجمع باعشن الطبي في صبيا، جازان — معتمد من CBAHI. احجز موعدك مع استشاريين في الباطنة والأطفال والنساء والولادة والأسنان والعيون، واطلب دواءك من صيدلياتنا مع خدمة رعاية منزلية.";
const HOME_OG_IMAGE = `https://bashenmedical.com${ogHomeAsset.url}`;
const OG_IMAGE_ALT_AR =
  "بطاقة مشاركة مجمع باعشن الطبي في صبيا، جازان — معتمد من CBAHI مع اسم المجمع وشعار الهلال والسمّاعة";
const OG_IMAGE_ALT_EN =
  "Baeshen Medical Complex share card — Sabya, Jazan, Saudi Arabia — CBAHI accredited";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(clinicSettingsQuery()),
  head: ({ loaderData }) => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      {
        name: "keywords",
        content:
          "مجمع باعشن الطبي, باعشن, مستشفى صبيا, أطباء جازان, حجز طبيب صبيا, صيدلية صبيا, رعاية منزلية جازان, CBAHI, Baeshen Medical, Sabya, Jazan",
      },
      { name: "author", content: "Baeshen Medical Complex" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "theme-color", content: "#0f766e" },
      // Open Graph
      { property: "og:site_name", content: "Baeshen Medical" },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:image", content: HOME_OG_IMAGE },
      { property: "og:image:secure_url", content: HOME_OG_IMAGE },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: OG_IMAGE_ALT_AR },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@BaeshenMedical" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
      { name: "twitter:image", content: HOME_OG_IMAGE },
      { name: "twitter:image:alt", content: OG_IMAGE_ALT_EN },
    ],
    links: [
      { rel: "canonical", href: HOME_URL },
      { rel: "alternate", hrefLang: "ar-SA", href: HOME_URL },
      { rel: "alternate", hrefLang: "en", href: HOME_URL },
      { rel: "alternate", hrefLang: "x-default", href: HOME_URL },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildLocalBusinessSchema({
            pageUrl: HOME_URL,
            settings: loaderData as ClinicSettings | undefined,
          }),
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Baeshen Medical",
          alternateName: "مجمع باعشن الطبي",
          url: HOME_URL,
          inLanguage: ["ar-SA", "en"],
          potentialAction: {
            "@type": "SearchAction",
            target: `${HOME_URL}health/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  component: HomePage,
});



function HomePage() {
  const { t, lang } = useI18n();
  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors_featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*, specialties(*)")
        .eq("is_active", true)
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <HeroComplex />
      <QuickBar />
      <StatsBar />

      <ServicesBento />

      {/* Specialties grid */}
      <section className="py-16 md:py-20">
        <div className="container-app">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                {lang === "ar" ? "التخصصات الطبية" : "Medical Specialties"}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">{t("specialties_title")}</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{t("specialties_sub")}</p>
            </div>
            <Link
              to="/specialties"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("all_specialties")} →
            </Link>
          </div>
          <StaggerReveal className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {specialties?.slice(0, 12).map((s) => (
              <RevealItem key={s.id}>
                <Link
                  to="/book"
                  search={{ specialty: s.slug }}
                  className="bento-card group p-5 block h-full"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="mt-3 font-semibold text-sm">
                    {lang === "ar" ? s.name_ar : s.name_en}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {lang === "ar" ? s.description_ar : s.description_en}
                  </div>
                </Link>
              </RevealItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      <CentersStrip />

      <PatientJourney />

      {/* Featured doctors */}
      <section className="py-16 md:py-20">
        <div className="container-app">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                {lang === "ar" ? "فريقنا الطبي" : "Our Medical Team"}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">{t("doctors_title")}</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{t("doctors_sub")}</p>
            </div>
            <Link
              to="/doctors"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("nav_doctors")} →
            </Link>
          </div>
          <StaggerReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {doctors?.map((d) => (
              <RevealItem key={d.id} className="bento-card p-5 flex flex-col items-center text-center">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center text-2xl font-bold shadow-lg shadow-primary/20">
                  {(lang === "ar" ? d.name_ar : d.name_en).charAt(0)}
                </div>
                <div className="mt-4">
                  <div className="font-bold">{lang === "ar" ? d.name_ar : d.name_en}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {lang === "ar" ? d.title_ar : d.title_en}
                  </div>
                </div>
                <Link
                  to="/book"
                  search={{ doctor: d.id }}
                  className="mt-4 w-full block text-center rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:bg-primary/90 transition"
                >
                  {t("book_with_doctor")}
                </Link>
              </RevealItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      <WhyChooseUs />

      <NewsStrip />

      <AwardsMarquee />

      <AppPromo />

      {/* Map/Location */}
      <section className="py-16 md:py-20 bg-secondary/40">
        <div className="container-app grid gap-8 md:grid-cols-2 items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
              {lang === "ar" ? "زُرنا" : "Visit us"}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              {lang === "ar" ? "موقعنا في قلب صبيا" : "In the heart of Sabya"}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {lang === "ar" ? SITE.addressAr : SITE.addressEn}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              {lang === "ar"
                ? `الرمز البريدي ${SITE.postalCode}`
                : `Postal code ${SITE.postalCode}`}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
              >
                {lang === "ar" ? "افتح في الخرائط" : "Open in Maps"}
              </a>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary transition"
              >
                {lang === "ar" ? "تواصل معنا" : "Contact us"}
              </Link>
            </div>
          </div>
          <div className="aspect-video rounded-2xl overflow-hidden border border-border shadow-lg">
            <iframe
              title="map"
              className="w-full h-full"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${SITE.lat},${SITE.lng}&z=15&output=embed`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

