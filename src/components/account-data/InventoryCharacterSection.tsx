import { UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Card, CardContent } from "@/components/ui/card";
import type { Character } from "@/domain/account/schemas";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogName,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";

interface InventoryCharacterSectionProps {
  characters: readonly Character[];
}

export function InventoryCharacterSection({
  characters,
}: InventoryCharacterSectionProps) {
  const { locale, t } = useI18n();
  const { data, error, loading } = useCharacterReferences();
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [combatTypeId, setCombatTypeId] = useState("all");

  const visibleCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return characters
      .filter((character) => pathId === "all" || character.pathId === pathId)
      .filter(
        (character) =>
          combatTypeId === "all" || character.combatTypeId === combatTypeId
      )
      .filter((character) => {
        if (!normalizedQuery) return true;
        const definition = data?.characters.byId.get(character.definitionId);
        const displayName = definition
          ? characterCatalogName(definition, locale, t("terms.trailblazer"))
          : character.definitionId;
        return `${displayName} ${localizedSearchText(
          definition?.name,
          character.definitionId
        )}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDefinition = data?.characters.byId.get(left.definitionId);
        const rightDefinition = data?.characters.byId.get(right.definitionId);
        const rarityDifference =
          (rightDefinition?.rarity ?? 0) - (leftDefinition?.rarity ?? 0);
        if (rarityDifference !== 0) return rarityDifference;
        return localizedName(
          leftDefinition?.name,
          locale,
          left.definitionId
        ).localeCompare(
          localizedName(rightDefinition?.name, locale, right.definitionId),
          locale
        );
      });
  }, [characters, combatTypeId, data, locale, pathId, query, t]);

  const pathOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allPaths") },
      ...Array.from(new Set(characters.map((character) => character.pathId)))
        .map((id) => ({
          value: id,
          label: localizedName(
            data?.properties.pathById.get(id)?.name,
            locale,
            id
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [characters, data, locale, t]
  );
  const combatTypeOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allCombatTypes") },
      ...Array.from(
        new Set(characters.map((character) => character.combatTypeId))
      )
        .map((id) => ({
          value: id,
          label: localizedName(
            data?.properties.combatTypeById.get(id)?.name,
            locale,
            id
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [characters, data, locale, t]
  );

  if (characters.length === 0) {
    return (
      <EmptyState messageKey="empty.inventoryCharacters" icon={UsersRound} />
    );
  }
  if (loading) return <CatalogLoading />;
  if (error || !data) return <CatalogLoadError error={error} />;

  return (
    <div className="space-y-3">
      <InventoryToolbar
        query={query}
        searchLabel={t("common.search")}
        searchPlaceholder={t("search.characters")}
        countLabel={
          visibleCharacters.length === 1
            ? t("common.oneRecord")
            : t("common.count", { count: visibleCharacters.length })
        }
        onQueryChange={setQuery}
        filters={[
          {
            id: "inventory-character-path",
            label: t("filter.path"),
            value: pathId,
            options: pathOptions,
            onChange: setPathId,
          },
          {
            id: "inventory-character-combat-type",
            label: t("filter.combatType"),
            value: combatTypeId,
            options: combatTypeOptions,
            onChange: setCombatTypeId,
          },
        ]}
      />
      {visibleCharacters.length === 0 ? (
        <EmptyState messageKey="empty.filtered" icon={UsersRound} />
      ) : (
        <section
          className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
          aria-label={t("inventory.charactersList")}
        >
          {visibleCharacters.map((character) => {
            const definition = data.characters.byId.get(character.definitionId);
            const name = definition
              ? characterCatalogName(definition, locale, t("terms.trailblazer"))
              : character.definitionId;
            const path = data.properties.pathById.get(character.pathId);
            const combatType = data.properties.combatTypeById.get(
              character.combatTypeId
            );
            return (
              <Card key={character.key} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-3">
                  <ItemIcon
                    kind="character"
                    id={definition?.id ?? character.definitionId}
                    sourcePath={definition?.icon_path ?? ""}
                    alt={`${name}, ${t("field.level", { value: character.level })}, ${t("field.eidolon", { value: character.eidolon })}`}
                    rarity={definition?.rarity ?? null}
                    badge={character.eidolon}
                    level={`Lv. ${character.level}`}
                    cornerAsset={
                      combatType
                        ? {
                            kind: "combat-type",
                            id: combatType.id,
                            sourcePath: combatType.icon_path,
                            alt: localizedName(
                              combatType.name,
                              locale,
                              character.combatTypeId
                            ),
                          }
                        : undefined
                    }
                    size="md"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {localizedName(path?.name, locale, character.pathId)}
                      {" · "}
                      {localizedName(
                        combatType?.name,
                        locale,
                        character.combatTypeId
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
