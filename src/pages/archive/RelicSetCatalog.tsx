import { useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { RelicSetCard } from "@/components/archive/RelicSetCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { filterArchiveItems } from "@/lib/archiveFilters";
import { formatGameText } from "@/lib/gameText";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";
import {
  getLocalizedValue,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type {
  RelicPieceDefinition,
  RelicSetDefinition,
} from "@/providers/gilore/types";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";

async function loadRelicArchiveData() {
  const [relicSets, relicPieces] = await Promise.all([
    loadRelicSets(),
    loadRelicPieces(),
  ]);
  return { relicSets, relicPieces };
}

export function RelicSetCatalog() {
  const { t } = useI18n();
  const resource = useCatalogResource(loadRelicArchiveData);
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<Set<RelicSetDefinition["kind"]>>(
    () => new Set()
  );
  const filtered = useMemo(() => {
    if (!resource.data) return [];
    const needle = query.trim().toLocaleLowerCase();
    return (
      filterArchiveItems(
        resource.data.relicSets.values,
        query,
        (set) =>
          (["en", "zh-CN"] as const).some((searchLocale) =>
            [set.name, ...set.bonuses.map((bonus) => bonus.description)].some(
              (text) =>
                formatGameText(getLocalizedValue(text, searchLocale))
                  .toLocaleLowerCase()
                  .includes(needle)
            )
          ),
        (set) => kinds.size === 0 || kinds.has(set.kind)
      )
        // ReleaseVersion is the source patch, not an invented calendar date.
        // IDs only break ties within the same patch, keeping bilingual order equal.
        .sort(
          (left, right) =>
            compareReleaseVersionsDescending(
              left.release_version,
              right.release_version
            ) || Number(right.id) - Number(left.id)
        )
    );
  }, [kinds, query, resource.data]);
  const piecesBySet = useMemo(() => {
    const groups = new Map<string, RelicPieceDefinition[]>();
    for (const piece of resource.data?.relicPieces.values ?? []) {
      const group = groups.get(piece.set_id) ?? [];
      group.push(piece);
      groups.set(piece.set_id, group);
    }
    return groups;
  }, [resource.data]);

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;
  return (
    <ScrollLayout
      header={
        <div className="space-y-3">
          <ArchiveToolbar
            searchQuery={query}
            onSearchChange={setQuery}
            searchLabel={t("common.search")}
            searchPlaceholder={t("archive.search.relicSets")}
          >
            <FilterChipGroup
              label={t("filter.kind")}
              selectedValues={kinds}
              onSelectedValuesChange={setKinds}
              options={["cavern_relic", "planar_ornament"] as const}
              getKey={(kind) => kind}
              getLabel={(kind) =>
                t(
                  kind === "cavern_relic"
                    ? "archive.kind.cavern"
                    : "archive.kind.planar"
                )
              }
            />
          </ArchiveToolbar>
          <p className="text-sm text-muted-foreground">
            {t("archive.results", {
              shown: filtered.length,
              total: resource.data.relicSets.values.length,
            })}
          </p>
        </div>
      }
    >
      <section
        aria-label={t("archive.relicSetList")}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {filtered.length === 0 ? (
          <div className="col-span-full">
            <CatalogEmpty />
          </div>
        ) : (
          filtered.map((set) => (
            <RelicSetCard
              key={set.id}
              relicSet={set}
              pieces={piecesBySet.get(set.id) ?? []}
            />
          ))
        )}
      </section>
    </ScrollLayout>
  );
}
