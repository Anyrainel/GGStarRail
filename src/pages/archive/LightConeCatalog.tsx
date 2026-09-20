import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { LightConeCard } from "@/components/archive/LightConeCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import { filterArchiveItems } from "@/lib/archiveFilters";
import { formatGameText } from "@/lib/gameText";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";
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

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;
  const { propertyTables } = resource.data;
  const availablePaths = propertyTables.paths.filter((path) =>
    resource.data?.lightCones.values.some((cone) => cone.path_id === path.id)
  );

  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.search.lightCones")}
    >
      <FilterChipGroup
        options={availablePaths.map((path) => path.id)}
        selectedValues={paths}
        onSelectedValuesChange={setPaths}
        getKey={(id) => id}
        getIcon={(id) => (
          <AssetImage
            kind="path"
            id={id}
            sourcePath={propertyTables.pathById.get(id)?.icon_path}
            alt=""
            className="h-4 w-4 object-contain"
          />
        )}
        getLabel={(id) =>
          formatGameText(
            getLocalizedValue(propertyTables.pathById.get(id)?.name, locale) ??
              ""
          )
        }
        className="contents"
      />
      <span
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border sm:block"
      />
      <FilterChipGroup
        options={[5, 4, 3]}
        selectedValues={rarities}
        onSelectedValuesChange={setRarities}
        getKey={String}
        getLabel={(rarity) => `★${rarity}`}
        className="contents"
      />
    </ArchiveToolbar>
  );
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
                className="overflow-hidden rounded-xl border border-border bg-card/50"
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
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <AssetImage
                      kind="path"
                      id={path.id}
                      sourcePath={path.icon_path}
                      alt=""
                      className="h-9 w-9 rounded-lg bg-secondary p-1.5 object-contain"
                    />
                    <span className="font-semibold">{name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({cones.length})
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                </h2>
                {expanded && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 border-t border-border p-2 sm:p-3">
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
