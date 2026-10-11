import { Award, Database, Filter, Library, Swords } from "lucide-react";
import { FeatureCard } from "@/components/home/FeatureCard";
import { FeatureMatrix } from "@/components/home/FeatureMatrix";
import { WelcomeGuideManual } from "@/components/home/WelcomeGuideManual";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { WhatsNew } from "@/components/shared/WhatsNew";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";

export default function HomePage() {
  const { locale, t } = useI18n();
  return (
    <ScrollLayout bodyClassName="mx-auto flex min-h-full flex-col gap-6 overflow-x-hidden px-8 pb-4">
      <section className="space-y-1 pb-0 pt-6 text-center">
        <h1 className="flex h-16 items-center justify-center md:h-24">
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
                className="mx-auto h-full w-auto drop-shadow-[0_2px_1px_#243747]"
              />
            </>
          )}
        </h1>
        <p className="mx-auto max-w-2xl text-xl font-light text-foreground/80">
          {t("home.heroDescription")}
        </p>
        <div className="pt-2">
          <WelcomeGuideManual />
        </div>
      </section>
      <WhatsNew>
        <div className="flex flex-col gap-8">
          <FeatureCard
            featured
            icon={<Database className="size-6" />}
            eyebrow={t("nav.accountData")}
            headline={t("home.headline.accountData")}
            link={APP_PATHS.characters}
            bgImage="assets/ggstarrail/home/firefly.webp"
            bgPosition="55% 20%"
            bgScale={1.3}
            bgOffsetX="15%"
            bgOffsetY="10%"
            ctaText={t("home.openAccount")}
          />
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
            <FeatureCard
              icon={<Swords className="size-6" />}
              eyebrow={t("nav.teamDamageSection")}
              headline={t("home.headline.teamDamage")}
              link={APP_PATHS.teamDamage}
              bgImage="assets/ggstarrail/home/third-anniversary.webp"
              bgPosition="70% 30%"
              ctaText={t("home.openTeamDamage")}
            />
            <FeatureCard
              icon={<Filter className="size-6" />}
              eyebrow={t("nav.planning")}
              headline={t("home.headline.builds")}
              link={APP_PATHS.builds}
              bgImage="assets/ggstarrail/home/ruan-mei.webp"
              bgPosition="80% center"
              ctaText={t("home.openBuilds")}
            />
            <FeatureCard
              icon={<Award className="size-6" />}
              eyebrow={t("nav.tierList")}
              headline={t("home.headline.tierList")}
              link={APP_PATHS.tierCharacters}
              bgImage="assets/ggstarrail/home/hysilens.webp"
              bgPosition="45% center"
              ctaText={t("home.openTiers")}
            />
            <FeatureCard
              icon={<Library className="size-6" />}
              eyebrow={t("nav.archive")}
              headline={t("home.headline.archive")}
              link={APP_PATHS.archiveCharacters}
              bgImage="assets/ggstarrail/home/evernight.webp"
              bgPosition="55% center"
              bgScale={1.1}
              bgOffsetX="20%"
              ctaText={t("home.openArchive")}
            />
          </div>
        </div>
      </WhatsNew>
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
