import {
  ArrowRight,
  Database,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { loadCatalogAssetLookup } from "@/providers/gilore/assets";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const FEATURED_CHARACTER_IDS = ["1308", "1402", "1304"] as const;

export default function HomePage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const assetLookup = useCatalogResource(loadCatalogAssetLookup);

  const tools = [
    {
      path: APP_PATHS.characters,
      eyebrow: t("nav.accountData"),
      title: t("home.tool.account.title"),
      body: t("home.tool.account.body"),
      icon: Database,
      characterId: FEATURED_CHARACTER_IDS[0],
    },
    {
      path: APP_PATHS.builds,
      eyebrow: t("nav.planning"),
      title: t("home.tool.builds.title"),
      body: t("home.tool.builds.body"),
      icon: SlidersHorizontal,
      characterId: FEATURED_CHARACTER_IDS[1],
    },
    {
      path: APP_PATHS.archiveCharacters,
      eyebrow: t("nav.archive"),
      title: t("home.tool.archive.title"),
      body: t("home.tool.archive.body"),
      icon: Sparkles,
      characterId: FEATURED_CHARACTER_IDS[2],
    },
  ];

  return (
    <div className="space-y-5 pb-5">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card px-5 py-8 shadow-lg sm:px-10 sm:py-12">
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>GG Artifact</Badge>
            <Badge variant="outline">{t("site.starRail")}</Badge>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              {t("route.home.title")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("route.home.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={APP_PATHS.characters}>
                {t("home.openAccount")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={APP_PATHS.archiveCharacters}>
                {t("home.openArchive")}
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {account
              ? t("home.snapshot.counts", {
                  characters: account.characters.length,
                  lightCones: account.lightCones.length,
                  relics: account.relics.length,
                })
              : t("home.snapshot.empty")}
          </p>
        </div>
        <img
          src="/assets/ggstarrail/mark.svg"
          alt=""
          className="pointer-events-none absolute -bottom-20 -right-14 h-72 w-72 opacity-10 sm:h-96 sm:w-96"
        />
      </section>

      <section aria-labelledby="home-tools-title" className="space-y-3">
        <div>
          <h2 id="home-tools-title" className="text-xl font-semibold">
            {t("home.tools.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("home.tools.body")}
          </p>
        </div>
        <div className="space-y-4">
          <ToolCard
            {...tools[0]!}
            assetsReady={!assetLookup.loading}
            featured
          />
          <div className="grid gap-4 md:grid-cols-2">
            {tools.slice(1).map((tool) => (
              <ToolCard
                key={tool.path}
                {...tool}
                assetsReady={!assetLookup.loading}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolCard({
  path,
  eyebrow,
  title,
  body,
  icon: Icon,
  characterId,
  assetsReady,
  featured = false,
}: {
  path: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Database;
  characterId: string;
  assetsReady: boolean;
  featured?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Link
      to={path}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "relative h-full min-h-56 overflow-hidden transition-transform group-hover:-translate-y-0.5 group-hover:border-primary/50",
          featured && "min-h-64"
        )}
      >
        {assetsReady && (
          <AssetImage
            kind="character"
            id={characterId}
            sourcePath=""
            alt=""
            className={cn(
              "absolute bottom-0 right-0 h-48 w-48 object-contain object-bottom opacity-55 transition-opacity group-hover:opacity-75",
              featured && "h-64 w-64 sm:h-72 sm:w-72"
            )}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        <div
          className={cn(
            "relative z-10 flex h-full max-w-[75%] flex-col p-5",
            featured && "max-w-xl sm:p-7"
          )}
        >
          <Icon className="mb-7 h-6 w-6 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{body}</p>
          <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium">
            {t("common.open")}{" "}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
