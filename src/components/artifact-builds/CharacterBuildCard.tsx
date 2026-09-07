import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { SelectField } from "@/components/builds/BuildControls";
import { AssetImage } from "@/components/shared/AssetImage";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { APP_PATHS } from "@/config/navigation";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  characterCatalogPresentation,
  localizedName,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/gilore/types";
import { BuildCard } from "./BuildCard";

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
  const [adding, setAdding] = useState(false);
  const [cavernSetId, setCavernSetId] = useState("");
  const [planarSetId, setPlanarSetId] = useState("");
  const openAddBuild = () => {
    setCavernSetId("");
    setPlanarSetId("");
    setAdding(true);
  };
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const iconSize: ItemIconSize = isVeryNarrow ? "md" : "lg";
  const presentation = characterCatalogPresentation(
    character,
    references.properties,
    locale,
    t("terms.trailblazer")
  );
  const path = references.properties.pathById.get(character.path_id);
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

          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1.5 sm:gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-lg font-bold text-foreground md:text-xl">
                  {presentation.name}
                </h2>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-1 md:gap-2">
                <Badge
                  variant="outline"
                  className="flex max-w-full items-center gap-1 rounded-full border-2 border-current px-1.5 py-0 text-xs font-normal shadow-none md:px-2.5 md:py-0.5 md:text-sm md:font-medium"
                >
                  {combatType && (
                    <AssetImage
                      kind="combat-type"
                      id={combatType.id}
                      sourcePath={combatType.icon_path}
                      alt=""
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 object-contain md:h-5 md:w-5"
                    />
                  )}
                  <span className="truncate">
                    {presentation.combatTypeName}
                  </span>
                </Badge>

                <Badge
                  variant="outline"
                  className="flex max-w-full items-center gap-1 rounded-full border-2 border-current px-1.5 py-0 text-xs font-normal text-muted-foreground shadow-none md:px-2.5 md:py-0.5 md:text-sm md:font-medium"
                >
                  {path && (
                    <AssetImage
                      kind="path"
                      id={path.id}
                      sourcePath={path.icon_path}
                      alt=""
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 object-contain md:h-5 md:w-5"
                    />
                  )}
                  <span className="truncate">{presentation.pathName}</span>
                </Badge>
              </div>
            </div>
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
            builds.map((build) => {
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
      <ResponsiveDialog open={adding} onOpenChange={setAdding}>
        <ResponsiveDialogContent closeLabel={t("common.close")}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("build.addBuild")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("build.chooseSetsHelp")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-4 space-y-4">
            <SelectField
              label={t("build.cavernFourPiece")}
              value={cavernSetId}
              onChange={setCavernSetId}
              options={[
                { value: "", label: t("build.chooseSet") },
                ...references.relicSets.values
                  .filter((set) => set.kind === "cavern_relic")
                  .map((set) => ({
                    value: set.id,
                    label: localizedName(set.name, locale, set.id),
                  })),
              ]}
            />
            <SelectField
              label={t("build.planarTwoPiece")}
              value={planarSetId}
              onChange={setPlanarSetId}
              options={[
                { value: "", label: t("build.chooseSet") },
                ...references.relicSets.values
                  .filter((set) => set.kind === "planar_ornament")
                  .map((set) => ({
                    value: set.id,
                    label: localizedName(set.name, locale, set.id),
                  })),
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!cavernSetId || !planarSetId}
                onClick={() => {
                  onAddBuild({
                    cavern: { mode: "four-piece", setId: cavernSetId },
                    planarSetId,
                  });
                  setAdding(false);
                }}
              >
                {t("build.addBuild")}
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent);
