import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ArchiveChipDivider,
  ArchiveToolbar,
} from "@/components/archive/ArchiveToolbar";
import { LightConeCard } from "@/components/archive/LightConeCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import { compareReleaseVersionsDescending } from "@/lib/game/releaseVersion";
import { formatGameText } from "@/lib/game/text";
import { filterArchiveItems } from "@/lib/search/archiveFilters";
import { cn } from "@/lib/utils";
import {
  getLocalizedValue,
  loadLightCones,
  loadPropertyTables,
} from "@/providers/reference/catalog";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";

async function loadLightConeArchiveData() {
  const [lightCones, propertyTables] = await Promise.all([
    loadLightCones(),
    loadPropertyTables(),
  ]);
  return { lightCones, propertyTables };
}

export function LightConeCatalog() {
  const { locale, t } = useI18n();
  const resource = useCatalogResource(loadLightConeArchiveData);
  const [query, setQuery] = useState("");
  const [paths, setPaths] = useState<Set<string>>(() => new Set());
  const [rarities, setRarities] = useState<Set<number>>(() => new Set());
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );

  const filtered = useMemo(() => {
    if (!resource.data) return [];
    return filterArchiveItems(
      resource.data.lightCones.values,
      query,
      (cone, search) =>
        (["en", "zh-CN"] as const).some((searchLocale) =>
          [
            cone.name,
            cone.effect.name,
            cone.effect.description,
            cone.description,
            cone.background_description,
          ].some((text) =>
            formatGameText(
              getLocalizedValue(text, searchLocale),
              [],
              TRAILBLAZER_TERMS[searchLocale]
            )
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase())
          )
        ),
      (cone) =>
        (paths.size === 0 || paths.has(cone.path_id)) &&
        (rarities.size === 0 || rarities.has(cone.rarity))
    ).sort(
      (left, right) =>
        compareReleaseVersionsDescending(
          left.release_version,
          right.release_version
        ) ||
        right.rarity - left.rarity ||
        Number(right.id) - Number(left.id)
    );
  }, [paths, query, rarities, resource.data]);

  const propertyTables = resource.data?.propertyTables;
  const availablePaths =
    propertyTables?.paths.filter((path) =>
      resource.data?.lightCones.values.some((cone) => cone.path_id === path.id)
    ) ?? [];

  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.search.lightCones")}
    >
      {propertyTables && (
        <>
          <FilterChipGroup
            options={availablePaths.map((path) => path.id)}
            selectedValues={paths}
            onSelectedValuesChange={setPaths}
            getKey={(id) => id}
            getTitle={(id) =>
              formatGameText(
                getLocalizedValue(
                  propertyTables.pathById.get(id)?.name,
                  locale
                ) ?? id
              )
            }
            getIcon={(id) => (
              <AssetImage
                kind="path"
                id={id}
                sourcePath={propertyTables.pathById.get(id)?.icon_path}
                alt=""
                className="h-4 w-4 object-contain"
              />
            )}
            getLabel={(id) => (
              <span className="hidden sm:inline">
                {formatGameText(
                  getLocalizedValue(
                    propertyTables.pathById.get(id)?.name,
                    locale
                  ) ?? ""
                )}
              </span>
            )}
            className="contents"
          />
          <ArchiveChipDivider />
          <FilterChipGroup
            options={[5, 4, 3]}
            selectedValues={rarities}
            onSelectedValuesChange={setRarities}
            getKey={String}
            getLabel={(rarity) => `★${rarity}`}
            className="contents"
          />
        </>
      )}
    </ArchiveToolbar>
  );
  if (!resource.data) {
    return (
      <ScrollLayout header={header}>
        {resource.error ? (
          <CatalogFailure error={resource.error} />
        ) : (
          <CatalogLoading />
        )}
      </ScrollLayout>
    );
  }
  return (
    <ScrollLayout header={header} bodyClassName="space-y-4">
      <section aria-label={t("archive.lightConeList")} className="space-y-4">
        {filtered.length === 0 ? (
          <CatalogEmpty />
        ) : (
          availablePaths.map((path) => {
            const cones = filtered.filter((cone) => cone.path_id === path.id);
            if (cones.length === 0) return null;
            const name = formatGameText(getLocalizedValue(path.name, locale));
            const expanded = !collapsedPaths.has(path.id);
            return (
              <section
                key={path.id}
                className="overflow-hidden rounded-xl border border-border bg-gradient-card"
              >
                <h2>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setCollapsedPaths((current) => {
                        const next = new Set(current);
                        if (next.has(path.id)) next.delete(path.id);
                        else next.add(path.id);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/70 p-2">
                      <AssetImage
                        kind="path"
                        id={path.id}
                        sourcePath={path.icon_path}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </span>
                    <span className="text-lg font-semibold">{name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({cones.length})
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-200",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                </h2>
                {expanded && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1.5 border-t border-border px-1.5 pb-3 pt-2 md:gap-2 md:px-3">
                    {cones.map((lightCone) => (
                      <LightConeCard
                        key={lightCone.id}
                        lightCone={lightCone}
                        path={path}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </section>
    </ScrollLayout>
  );
}
