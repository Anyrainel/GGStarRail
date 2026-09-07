import { Database } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { betaEnabled } from "@/data/betaState";
import { useBetaSearch } from "@/hooks/useBetaSearch";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { HSR_REFERENCE_MANIFEST } from "@/providers/gilore/catalog";
import { AchievementArchiveView } from "./AchievementArchiveView";
import { BetaPreviews } from "./BetaPreviews";
import { CharacterCatalog } from "./CharacterCatalog";
import { LightConeCatalog } from "./LightConeCatalog";
import { RelicSetCatalog } from "./RelicSetCatalog";

export type ArchiveKind =
  | "characters"
  | "lightCones"
  | "relicSets"
  | "achievements";

interface ArchivePageProps {
  kind: ArchiveKind;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}

export default function ArchivePage({
  kind,
  titleKey,
  descriptionKey,
}: ArchivePageProps) {
  const { t } = useI18n();
  const { changeSearch, error } = useBetaSearch(() => {});
  return (
    <>
      <PageHeader
        titleKey={titleKey}
        descriptionKey={descriptionKey}
        visuallyHidden
      />
      {betaEnabled() && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm">
          <Badge>{t("beta.enabled")}</Badge>
          <Button
            variant="outline"
            onClick={() => changeSearch("关闭测试模式")}
          >
            {t("beta.disable")}
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
      )}
      {betaEnabled() && kind !== "achievements" && <BetaPreviews kind={kind} />}
      {kind === "characters" && <CharacterCatalog />}
      {kind === "lightCones" && <LightConeCatalog />}
      {kind === "relicSets" && <RelicSetCatalog />}
      {kind === "achievements" && <AchievementArchiveView />}
      <CatalogProvenance />
    </>
  );
}

function CatalogProvenance() {
  const { t } = useI18n();
  const manifest = HSR_REFERENCE_MANIFEST;
  return (
    <details className="rounded-xl border border-border bg-card/20 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        {t("archive.dataDetails")}
      </summary>
      <section className="mt-3 grid gap-3">
        <p className="text-sm font-medium">{t("beta.releasedSummary")}</p>
        <div className="rounded-xl border border-border bg-background/35 p-4">
          <div className="flex items-start gap-3">
            <Database
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{t("archive.bundle.title")}</h2>
                <Badge>{manifest.schema_version}</Badge>
                <Badge variant="outline">{t("archive.bundle.bilingual")}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("archive.bundle.summary", {
                  characters: manifest.counts.characters,
                  lightCones: manifest.counts.light_cones,
                  sets: manifest.counts.relic_sets,
                  logical: manifest.counts.logical_relic_pieces,
                  variants: manifest.counts.relic_piece_variants,
                })}
              </p>
              {manifest.schema_version !== "1.0.0" && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t("archive.bundle.additiveSummary", {
                    skills: manifest.counts.character_skills,
                    ranks: manifest.counts.character_ranks,
                    traces: manifest.counts.character_trace_nodes,
                    servants: manifest.counts.character_servants,
                    variants: manifest.counts.character_enhancement_variants,
                    superimpositions:
                      manifest.counts.light_cone_superimpositions,
                    items: manifest.counts.progression_items,
                  })}
                </p>
              )}
              {manifest.schema_version === "1.2.0" && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t("archive.bundle.achievementSummary", {
                    categories: manifest.counts.achievement_categories,
                    achievements: manifest.counts.achievements,
                    showAfterFinish:
                      manifest.counts.achievements_show_after_finish,
                    hiddenDescriptions:
                      manifest.counts.achievements_hidden_description,
                    versions: manifest.counts.achievements_with_release_version,
                  })}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {t("archive.bundle.source")}
              </p>
              <code className="mt-1 block break-all text-xs">
                {manifest.source.revision}
              </code>
            </div>
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          {t("archive.license.warning")}
        </p>
      </section>
    </details>
  );
}
