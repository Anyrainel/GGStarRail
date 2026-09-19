import { useMemo, useState } from "react";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { RelicSetCard } from "@/components/archive/RelicSetCard";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
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
  const { locale, t } = useI18n();
  const resource = useCatalogResource(loadRelicArchiveData);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<RelicSetDefinition["kind"]>("cavern_relic");
  const matchingSets = useMemo(() => {
    if (!resource.data) return [];
    const needle = query.trim().toLocaleLowerCase();
    return resource.data.relicSets.values
      .filter(
        (set) =>
          !needle ||
          (["en", "zh-CN"] as const).some((searchLocale) =>
            [set.name, ...set.bonuses.map((bonus) => bonus.description)].some(
              (text) =>
                formatGameText(getLocalizedValue(text, searchLocale))
                  .toLocaleLowerCase()
                  .includes(needle)
            )
          )
      )
      .sort((left, right) =>
        formatGameText(getLocalizedValue(left.name, locale)).localeCompare(
          formatGameText(getLocalizedValue(right.name, locale)),
          locale
        )
      );
  }, [locale, query, resource.data]);
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
  const filtered = matchingSets.filter((set) => set.kind === kind);
  return (
    <div className="space-y-4">
      <ArchiveToolbar
        searchQuery={query}
        onSearchChange={setQuery}
        searchLabel={t("common.search")}
        searchPlaceholder={t("archive.search.relicSets")}
      />
      <ArchiveTabs
        panelId="relic-set-panel"
        label={t("filter.kind")}
        value={kind}
        onValueChange={setKind}
        options={[
          {
            value: "cavern_relic",
            label: t("archive.kind.cavern"),
            count: matchingSets.filter((set) => set.kind === "cavern_relic")
              .length,
          },
          {
            value: "planar_ornament",
            label: t("archive.kind.planar"),
            count: matchingSets.filter((set) => set.kind === "planar_ornament")
              .length,
          },
        ]}
      />
      <div
        id="relic-set-panel"
        role="tabpanel"
        aria-labelledby={`relic-set-panel-tab-${kind}`}
      >
        <section
          aria-label={t("archive.relicSetList")}
          className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
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
      </div>
    </div>
  );
}
