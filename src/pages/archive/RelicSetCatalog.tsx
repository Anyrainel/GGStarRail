import { useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { useRowExpansion } from "@/components/archive/CollapsibleBody";
import { RelicSetCard } from "@/components/archive/RelicSetCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { VirtualCollection } from "@/components/shared/VirtualCollection";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { compareReleaseVersionsDescending } from "@/lib/game/releaseVersion";
import { formatGameText } from "@/lib/game/text";
import { filterArchiveItems } from "@/lib/search/archiveFilters";
import {
  getLocalizedValue,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/reference/catalog";
import type {
  RelicPieceDefinition,
  RelicSetDefinition,
} from "@/providers/reference/types";
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
  const rows = useRowExpansion();
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

  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.search.relicSets")}
    >
      <FilterChipGroup
        selectedValues={kinds}
        onSelectedValuesChange={setKinds}
        options={["cavern_relic", "planar_ornament"] as const}
        getKey={(kind) => kind}
        getIcon={(kind) => (
          <RelicKindIcon
            kind={kind === "planar_ornament" ? "planar" : "cavern"}
            className="h-3.5 w-3.5"
            decorative
          />
        )}
        getLabel={(kind) =>
          t(
            kind === "cavern_relic"
              ? "archive.kind.cavern"
              : "archive.kind.planar"
          )
        }
        className="contents"
      />
    </ArchiveToolbar>
  );
  return (
    <ScrollLayout header={header}>
      {!resource.data ? (
        resource.error ? (
          <CatalogFailure error={resource.error} />
        ) : (
          <CatalogLoading />
        )
      ) : (
        <section
          aria-label={t("archive.relicSetList")}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.length === 0 ? (
            <div className="col-span-full">
              <CatalogEmpty />
            </div>
          ) : (
            <VirtualCollection
              className="col-span-full"
              items={filtered}
              getKey={(set) => set.id}
              gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
            >
              {(set, index) => {
                const row = rows.rowOf(index);
                return (
                  <RelicSetCard
                    key={set.id}
                    relicSet={set}
                    pieces={piecesBySet.get(set.id) ?? []}
                    expanded={rows.isExpanded(row)}
                    onToggleExpanded={() => rows.toggleRow(row)}
                  />
                );
              }}
            </VirtualCollection>
          )}
        </section>
      )}
    </ScrollLayout>
  );
}
