import { memo } from "react";
import { Link } from "react-router-dom";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/reference/types";
import { buildDisplayName } from "@/services/builds/presentation";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { characterCatalogPresentation } from "@/services/catalog/presentation";
import type { RelicKind } from "@/services/catalog/relicPresentation";
import { characterArchiveHref } from "@/services/navigation/characterArchiveLink";
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
            "flex w-full min-w-0 items-center",
            isVeryNarrow ? "gap-2" : "gap-3 md:gap-4"
          )}
          data-character-build-header
        >
          <CatalogHoverCard kind="character" id={character.id}>
            <Link
              to={characterArchiveHref(character.id)}
              aria-label={t("characterLoadout.openArchive", {
                name: presentation.name,
              })}
              className="shrink-0 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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

          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-4">
            <div className="min-w-0 flex-1">
              <CharacterInfo
                character={character}
                properties={references.properties}
              />
            </div>
            <CharacterLightCones
              character={character}
              references={references}
              iconSize={iconSize}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("pb-3", isVeryNarrow ? "px-2" : "px-3")}>
        {builds.length > 0 && (
          <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
            {CATEGORIES.map((category) => {
              const categoryBuilds = builds.filter(
                (build) => build.category === category
              );
              return (
                <section
                  key={category}
                  className="flex min-w-0 flex-col gap-2"
                  aria-label={t(CATEGORY_LABEL[category])}
                  data-build-column={category}
                >
                  {categoryBuilds.length > 0 && (
                    <h3 className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                      {t(CATEGORY_LABEL[category])}
                    </h3>
                  )}
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
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {CATEGORIES.map((category) => (
            <AddBuildButton
              key={category}
              category={category}
              narrow={isVeryNarrow}
              onClick={() => onAddBuild(category)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CATEGORIES = ["cavern", "planar"] as const satisfies readonly RelicKind[];

const CATEGORY_LABEL = {
  cavern: "build.cavernCards",
  planar: "build.planarCards",
} as const;

const ADD_LABEL = {
  cavern: "build.addCavern",
  planar: "build.addPlanar",
} as const;

/** Equal-width add actions share one row beneath the build sections. */
function AddBuildButton({
  category,
  narrow,
  onClick,
}: {
  category: RelicKind;
  narrow: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "min-w-0 gap-1.5 whitespace-normal px-2",
        narrow ? "h-auto min-h-7 py-1 text-xs" : "h-9 text-sm"
      )}
      onClick={onClick}
    >
      {t(ADD_LABEL[category])}
    </Button>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent);
