import { Plus } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogPresentation } from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { BuildCard } from "./BuildCard";
import { CharacterLightCones } from "./CharacterLightCones";

interface CharacterBuildCardProps {
  character: CharacterDefinition;
  builds: readonly BuildConfiguration[];
  profiles: ReadonlyMap<string, ScoreProfile>;
  references: BuildReferences;
  onAddBuild: (
    setPlan: Pick<BuildConfiguration, "cavern" | "planarSetId">
  ) => void;
  onBuildChange: (build: BuildConfiguration) => void;
  onProfileChange: (profile: ScoreProfile) => void;
  onDeleteBuild: (build: BuildConfiguration) => void;
}

function CharacterBuildCardComponent({
  character,
  builds,
  profiles,
  references,
  onAddBuild,
  onBuildChange,
  onProfileChange,
  onDeleteBuild,
}: CharacterBuildCardProps) {
  const { locale, t } = useI18n();
  const duplicateBuild = useWorkspaceStore((state) => state.duplicateBuild);
  const moveBuild = useWorkspaceStore((state) => state.moveBuild);
  const openAddBuild = () => {
    const previous = builds.at(-1);
    const cavernSetId = previous
      ? previous.cavern.mode === "four-piece"
        ? previous.cavern.setId
        : previous.cavern.setIds[0]
      : references.relicSets.values.find((set) => set.kind === "cavern_relic")
          ?.id;
    const planarSetId =
      previous?.planarSetId ??
      references.relicSets.values.find((set) => set.kind === "planar_ornament")
        ?.id;
    if (!cavernSetId || !planarSetId) {
      throw new Error("Build creation requires Cavern and Planar set catalogs");
    }
    onAddBuild({
      cavern: { mode: "four-piece", setId: cavernSetId },
      planarSetId,
    });
  };
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const iconSize: ItemIconSize = isVeryNarrow ? "md" : "lg";
  const presentation = characterCatalogPresentation(
    character,
    references.properties,
    locale,
    t("terms.trailblazer")
  );
  const combatType = references.properties.combatTypeById.get(
    character.combat_type_id
  );
  const characterIconLabel = presentation.name;

  return (
    <Card
      role="article"
      aria-label={t("build.characterIdentity", {
        character: presentation.name,
        path: presentation.pathName,
        combatType: presentation.combatTypeName,
      })}
      className="overflow-hidden bg-gradient-card"
      data-character-build-card={character.id}
    >
      <CardHeader className={cn("pb-3 pt-3", isVeryNarrow ? "px-2" : "px-3")}>
        <div
          className={cn(
            "flex min-w-0 items-center",
            isVeryNarrow ? "gap-2" : "gap-3 md:gap-4"
          )}
          data-character-build-header
        >
          <CatalogHoverCard kind="character" id={character.id}>
            <Link
              to={`${APP_PATHS.archiveCharacters}?character=${encodeURIComponent(character.id)}`}
              aria-label={t("characterLoadout.openArchive", {
                name: presentation.name,
              })}
              className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ItemIcon
                kind="character"
                id={character.id}
                sourcePath={character.icon_path}
                alt={characterIconLabel}
                rarity={character.rarity}
                cornerAsset={
                  combatType
                    ? {
                        kind: "combat-type",
                        id: combatType.id,
                        sourcePath: combatType.icon_path,
                        alt: presentation.combatTypeName,
                      }
                    : undefined
                }
                size={iconSize}
              />
            </Link>
          </CatalogHoverCard>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 md:gap-4">
            <div className="min-w-[9rem] flex-1">
              <CharacterInfo
                character={character}
                properties={references.properties}
              />
            </div>
            <CharacterLightCones
              character={character}
              references={references}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("pb-3", isVeryNarrow ? "px-2" : "px-3")}>
        <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
          {builds.length === 0 ? (
            <div className="col-span-full flex justify-center py-2 text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "gap-2",
                  isVeryNarrow ? "h-7 text-xs" : "h-9 text-sm"
                )}
                onClick={openAddBuild}
              >
                <Plus
                  className={isVeryNarrow ? "h-3 w-3" : "h-4 w-4"}
                  aria-hidden="true"
                />
                {t("build.addFirstBuild")}
              </Button>
            </div>
          ) : (
            builds.map((build, index) => {
              const profile = profiles.get(build.scoreProfileId);
              if (!profile) return null;
              return (
                <BuildCard
                  key={build.id}
                  build={build}
                  profile={profile}
                  references={references}
                  onBuildChange={onBuildChange}
                  onProfileChange={onProfileChange}
                  onDelete={() => onDeleteBuild(build)}
                  onDuplicate={() =>
                    duplicateBuild(
                      build.id,
                      t("build.copyName", { name: build.name }).slice(0, 80)
                    )
                  }
                  onMove={(direction) => moveBuild(build.id, direction)}
                  canMoveUp={index > 0}
                  canMoveDown={index < builds.length - 1}
                />
              );
            })
          )}
        </div>

        {builds.length > 0 && (
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 gap-2",
                isVeryNarrow ? "h-7 text-xs" : "h-9 text-sm"
              )}
              onClick={openAddBuild}
            >
              <Plus
                className={isVeryNarrow ? "h-3 w-3" : "h-4 w-4"}
                aria-hidden="true"
              />
              {t("build.addBuild")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent);
