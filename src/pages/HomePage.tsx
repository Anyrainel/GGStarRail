import { Award, Database, Filter, Library } from "lucide-react";
import { FeatureCard } from "@/components/home/FeatureCard";
import { FeatureMatrix } from "@/components/home/FeatureMatrix";
import { WelcomeGuideManual } from "@/components/home/WelcomeGuideManual";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";

export default function HomePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-1 pb-6 sm:px-4">
      <section className="space-y-3 pb-2 pt-5 text-center sm:pt-7">
        <div className="mx-auto flex w-full flex-col items-center">
          <h1 className="w-full max-w-[30rem]">
            <span className="sr-only">{t("home.brand")}</span>
            <img
              src={getAssetUrl("assets/ggstarrail/wordmark.svg")}
              alt=""
              width="560"
              height="200"
              className="h-auto w-full drop-shadow-lg"
            />
          </h1>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground/75 sm:text-sm">
            {t("site.starRail")}
          </p>
        </div>
        <p className="mx-auto max-w-2xl text-base font-light leading-relaxed text-foreground/75 sm:text-lg">
          {t("route.home.description")}
        </p>
        <div className="pt-1">
          <WelcomeGuideManual />
        </div>
      </section>
      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        <FeatureCard
          icon={<Database className="size-6" />}
          title={t("nav.accountData")}
          problem={t("home.tool.account.title")}
          guideline={t("home.tool.account.body")}
          link={APP_PATHS.characters}
          bgImage="assets/ggstarrail/home/firefly.webp"
          bgPosition="55% center"
          ctaText={t("home.openAccount")}
        />
        <FeatureCard
          icon={<Filter className="size-6" />}
          title={t("nav.planning")}
          problem={t("home.tool.builds.title")}
          guideline={t("home.tool.builds.body")}
          link={APP_PATHS.builds}
          bgImage="assets/ggstarrail/home/ruan-mei.webp"
          bgPosition="80% center"
          ctaText={t("home.openBuilds")}
        />
        <FeatureCard
          icon={<Award className="size-6" />}
          title={t("nav.tierList")}
          problem={t("home.tool.tiers.title")}
          guideline={t("home.tool.tiers.body")}
          link={APP_PATHS.tierCharacters}
          bgImage="assets/ggstarrail/home/hysilens.webp"
          bgPosition="45% center"
          ctaText={t("home.openTiers")}
        />
        <FeatureCard
          icon={<Library className="size-6" />}
          title={t("nav.archive")}
          problem={t("home.tool.archive.title")}
          guideline={t("home.tool.archive.body")}
          link={APP_PATHS.archiveCharacters}
          bgImage="assets/ggstarrail/home/evernight.webp"
          bgPosition="55% center"
          ctaText={t("home.openArchive")}
        />
      </section>
      <FeatureMatrix />
    </div>
  );
}
