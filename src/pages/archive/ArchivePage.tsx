import { Database, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import {
  HSR_REFERENCE_MANIFEST,
  loadDiagnostics,
} from "@/providers/gilore/catalog";
import { CharacterCatalog } from "./CharacterCatalog";
import { LightConeCatalog } from "./LightConeCatalog";
import { RelicSetCatalog } from "./RelicSetCatalog";

export type ArchiveKind = "characters" | "lightCones" | "relicSets";

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
  return (
    <>
      <PageHeader
        titleKey={titleKey}
        descriptionKey={descriptionKey}
        visuallyHidden
      />
      {kind === "characters" && <CharacterCatalog />}
      {kind === "lightCones" && <LightConeCatalog />}
      {kind === "relicSets" && <RelicSetCatalog />}
      <CatalogProvenance />
    </>
  );
}

function CatalogProvenance() {
  const { t } = useI18n();
  const diagnostics = useCatalogResource(loadDiagnostics);
  const manifest = HSR_REFERENCE_MANIFEST;
  return (
    <details className="rounded-xl border border-border bg-card/20 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        {t("archive.dataDetails")}
      </summary>
      <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
              {manifest.schema_version === "1.1.0" && (
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
              <p className="mt-2 text-xs text-muted-foreground">
                {t("archive.bundle.source")}
              </p>
              <code className="mt-1 block break-all text-xs">
                {manifest.source.revision}
              </code>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/35 p-4 lg:max-w-md">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">{t("archive.gaps.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {diagnostics.data
                  ? t("archive.gaps.summary", {
                      gaps: diagnostics.data.source_gaps.length,
                      disagreements:
                        diagnostics.data.source_disagreements.length,
                    })
                  : t("common.loading")}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("archive.license.warning")}
              </p>
              {diagnostics.data && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-medium">
                    {t("archive.gaps.details")}
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {diagnostics.data.source_gaps.map((gap) => (
                      <li key={`${gap.table}:${gap.record_id}:${gap.field}`}>
                        <code>{gap.record_id}</code> — {gap.field}
                      </li>
                    ))}
                    {diagnostics.data.source_disagreements.map((gap) => (
                      <li key={gap.evidence_id}>
                        <code>{gap.entity_id}</code> — {gap.field}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </div>
      </section>
    </details>
  );
}
