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
import { buildDisplayName } from "@/lib/buildPresentation";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogPresentation } from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/reference/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { BuildCard } from "./BuildCard";
import { CharacterLightCones } from "./CharacterLightCones";

interface CharacterBuildCardProps {
  character: CharacterDefinition;
  builds: readonly BuildConfiguration[];
  profiles: ReadonlyMap<string, ScoreProfile>;
  references: BuildReferences;
  onAddBuild: (category: BuildConfiguration["category"]) => void;
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(["cavern", "planar"] as const).map((category) => {
            const categoryBuilds = builds.filter(
              (build) => build.category === category
            );
            return (
              <section
                key={category}
                className="min-w-0 space-y-2"
                aria-label={t(
                  category === "cavern"
                    ? "build.cavernCards"
                    : "build.planarCards"
                )}
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <h3 className="text-sm font-semibold">
                    {t(
                      category === "cavern"
                        ? "build.cavernCards"
                        : "build.planarCards"
                    )}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onAddBuild(category)}
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {t(
                      category === "cavern"
                        ? "build.addCavern"
                        : "build.addPlanar"
                    )}
                  </Button>
                </div>
                {categoryBuilds.map((build, index) => {
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
                          t("build.copyName", {
                            name: buildDisplayName(build, references, locale),
                          }).slice(0, 80)
                        )
                      }
                      onMove={(direction) => moveBuild(build.id, direction)}
                      canMoveUp={index > 0}
                      canMoveDown={index < categoryBuilds.length - 1}
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent);
