import { Award, Compass, Database, Filter, Library } from "lucide-react";
import { Link } from "react-router-dom";
import { FeatureCard } from "@/components/home/FeatureCard";
import { FeatureMatrix } from "@/components/home/FeatureMatrix";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";
import { loadCatalogAssetLookup } from "@/providers/gilore/assets";

export default function HomePage() {
  const { t } = useI18n();
  const assetLookup = useCatalogResource(loadCatalogAssetLookup);
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-1 pb-6 sm:px-4">
      <section className="space-y-3 pb-2 pt-5 text-center sm:pt-7">
        <div className="relative isolate mx-auto flex w-fit flex-col items-center px-6">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 96"
            className="pointer-events-none absolute -top-2 left-1/2 -z-10 h-28 w-[min(24rem,90vw)] -translate-x-1/2 text-primary/40"
          >
            <ellipse
              cx="180"
              cy="48"
              rx="164"
              ry="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              transform="rotate(-12 180 48)"
            />
            <path
              d="m35 62 8-2m272-27 10-2M74 24h5m-2.5-2.5v5M282 73h7m-3.5-3.5v7"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <img
            src={getAssetUrl("assets/ggstarrail/mark.svg")}
            alt=""
            className="mb-1 h-12 w-12"
          />
          <h1 className="bg-gradient-to-br from-foreground via-primary to-foreground bg-clip-text pb-1 text-4xl font-black italic tracking-tight text-transparent sm:text-6xl">
            {t("home.brand")}
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary sm:text-sm">
            {t("site.starRail")}
          </p>
        </div>
        <p className="mx-auto max-w-2xl text-base font-light leading-relaxed text-foreground/75 sm:text-lg">
          {t("route.home.description")}
        </p>
        <div className="pt-1">
          <Button asChild className="h-11 gap-2.5 px-6">
            <Link to={APP_PATHS.characters}>
              <Compass className="size-5" aria-hidden="true" />
              {t("home.openAccount")}
            </Link>
          </Button>
        </div>
      </section>
      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        <FeatureCard
          icon={<Database className="size-6" />}
          title={t("nav.accountData")}
          problem={t("home.tool.account.title")}
          guideline={t("home.tool.account.body")}
          link={APP_PATHS.characters}
          characterId="1308"
          ctaText={t("home.openAccount")}
          assetsReady={!assetLookup.loading}
        />
        <FeatureCard
          icon={<Filter className="size-6" />}
          title={t("nav.planning")}
          problem={t("home.tool.builds.title")}
          guideline={t("home.tool.builds.body")}
          link={APP_PATHS.builds}
          characterId="1402"
          ctaText={t("home.openBuilds")}
          assetsReady={!assetLookup.loading}
        />
        <FeatureCard
          icon={<Award className="size-6" />}
          title={t("nav.tierList")}
          problem={t("home.tool.tiers.title")}
          guideline={t("home.tool.tiers.body")}
          link={APP_PATHS.tierCharacters}
          characterId="1304"
          ctaText={t("home.openTiers")}
          assetsReady={!assetLookup.loading}
        />
        <FeatureCard
          icon={<Library className="size-6" />}
          title={t("nav.archive")}
          problem={t("home.tool.archive.title")}
          guideline={t("home.tool.archive.body")}
          link={APP_PATHS.archiveCharacters}
          characterId="1310"
          ctaText={t("home.openArchive")}
          assetsReady={!assetLookup.loading}
        />
      </section>
      <FeatureMatrix />
    </div>
  );
}
