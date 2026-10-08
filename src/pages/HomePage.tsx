import { Award, Database, Filter, Library } from "lucide-react";
import { FeatureCard } from "@/components/home/FeatureCard";
import { FeatureMatrix } from "@/components/home/FeatureMatrix";
import { WelcomeGuideManual } from "@/components/home/WelcomeGuideManual";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";

export default function HomePage() {
  const { locale, t } = useI18n();
  return (
    <ScrollLayout bodyClassName="mx-auto flex min-h-full flex-col gap-6 overflow-x-hidden px-8 pb-4">
      <section className="space-y-3 pb-2 pt-5 text-center sm:pt-7">
        <div className="mx-auto flex w-full flex-col items-center">
          <h1 className="flex aspect-[14/5] w-full max-w-[30rem] items-center justify-center">
            {locale === "zh-CN" ? (
              <span className="font-serif text-4xl font-bold tracking-wide text-primary drop-shadow-md md:text-6xl">
                {t("home.brand")}
              </span>
            ) : (
              <>
                <span className="sr-only">{t("home.brand")}</span>
                <img
                  src={getAssetUrl("assets/ggstarrail/wordmark.svg")}
                  alt=""
                  width="560"
                  height="200"
                  className="h-auto w-full drop-shadow-[0_2px_1px_#243747]"
                />
              </>
            )}
          </h1>
          <p className="mx-auto max-w-2xl text-base font-light leading-relaxed text-foreground/80 sm:text-xl">
            {t("home.heroDescription")}
          </p>
        </div>
        <div className="pt-2">
          <WelcomeGuideManual />
        </div>
      </section>
      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        <FeatureCard
          icon={<Database className="size-6" />}
          title={t("nav.accountData")}
          link={APP_PATHS.characters}
          bgImage="assets/ggstarrail/home/firefly.webp"
          bgPosition="55% center"
          bgScale={1.3}
          bgOffsetX="20%"
          ctaText={t("home.openAccount")}
        />
        <FeatureCard
          icon={<Filter className="size-6" />}
          title={t("nav.planning")}
          link={APP_PATHS.builds}
          bgImage="assets/ggstarrail/home/ruan-mei.webp"
          bgPosition="80% center"
          ctaText={t("home.openBuilds")}
        />
        <FeatureCard
          icon={<Award className="size-6" />}
          title={t("nav.tierList")}
          link={APP_PATHS.tierCharacters}
          bgImage="assets/ggstarrail/home/hysilens.webp"
          bgPosition="45% center"
          ctaText={t("home.openTiers")}
        />
        <FeatureCard
          icon={<Library className="size-6" />}
          title={t("nav.archive")}
          link={APP_PATHS.archiveCharacters}
          bgImage="assets/ggstarrail/home/evernight.webp"
          bgPosition="55% center"
          bgScale={1.1}
          bgOffsetX="20%"
          ctaText={t("home.openArchive")}
        />
      </section>
      <FeatureMatrix />
      <footer className="mt-auto space-y-1 border-t border-border/20 pb-2 pt-6 text-center text-xs leading-relaxed text-muted-foreground">
        <p>
          {t("home.disclaimerPrefix")}
          <a
            href="https://github.com/Anyrainel/GGStarRail"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("home.disclaimerProject")}
          </a>
          {t("home.disclaimerSuffix")}
        </p>
        <p>{t("home.dataAttribution")}</p>
      </footer>
    </ScrollLayout>
  );
}
