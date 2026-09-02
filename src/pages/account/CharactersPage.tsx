import { UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCharacterReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedSearchText } from "@/lib/catalogPresentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharactersPage() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const characters = account?.characters ?? [];
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
        return localizedSearchText(
          definition?.name,
          character.definitionId
        ).includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDefinition = data?.characters.byId.get(left.definitionId);
        const rightDefinition = data?.characters.byId.get(right.definitionId);
        return localizedName(
          leftDefinition?.name,
          locale,
          left.definitionId
        ).localeCompare(
          localizedName(rightDefinition?.name, locale, right.definitionId),
          locale
        );
      });
  }, [characters, combatTypeId, data, locale, pathId, query]);

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

  return (
    <>
      <PageHeader
        titleKey="route.characters.title"
        descriptionKey="route.characters.description"
      />
      <AccountCoverageNotice account={account} />
      {characters.length === 0 ? (
        account ? (
          <EmptyState messageKey="empty.characters" icon={UsersRound} />
        ) : (
          <WorkspaceStartState
            messageKey="empty.characters"
            icon={UsersRound}
          />
        )
      ) : loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <>
          <InventoryToolbar
            query={query}
            searchLabel={t("common.search")}
            searchPlaceholder={t("search.characters")}
            countLabel={t("common.count", {
              count: visibleCharacters.length,
            })}
            onQueryChange={setQuery}
            filters={[
              {
                id: "path",
                label: t("filter.path"),
                value: pathId,
                options: pathOptions,
                onChange: setPathId,
              },
              {
                id: "combat-type",
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
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCharacters.map((character) => {
                const definition = data.characters.byId.get(
                  character.definitionId
                );
                const name = localizedName(
                  definition?.name,
                  locale,
                  character.definitionId
                );
                const path = data.properties.pathById.get(character.pathId);
                const combatType = data.properties.combatTypeById.get(
                  character.combatTypeId
                );
                return (
                  <Card key={character.key} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <AssetImage
                        kind="character"
                        id={definition?.id ?? character.definitionId}
                        sourcePath={definition?.icon_path ?? ""}
                        alt={name}
                        className="h-16 w-16 shrink-0 rounded-lg bg-background/70 object-contain"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <CardTitle className="truncate text-base">
                          {name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          {definition && (
                            <Badge variant="secondary">
                              {t("field.rarity", {
                                value: definition.rarity,
                              })}
                            </Badge>
                          )}
                          <Badge>
                            {t("field.level", { value: character.level })}
                          </Badge>
                          <Badge variant="outline">
                            {t("field.eidolon", { value: character.eidolon })}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm text-muted-foreground">
                      <p>
                        {t("field.path", {
                          value: localizedName(
                            path?.name,
                            locale,
                            character.pathId
                          ),
                        })}
                      </p>
                      <p>
                        {t("field.combatType", {
                          value: localizedName(
                            combatType?.name,
                            locale,
                            character.combatTypeId
                          ),
                        })}
                      </p>
                      <p>
                        {t("field.ascension", { value: character.ascension })}
                        {" · "}
                        {t("field.relicCount", {
                          value: character.relicKeys.length,
                        })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );
}
