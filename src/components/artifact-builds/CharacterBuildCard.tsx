import { Plus } from "lucide-react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Character } from "@/domain/account/schemas";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogPresentation } from "@/lib/catalogPresentation";
import type { CharacterDefinition } from "@/providers/gilore/types";
import { BuildCard } from "./BuildCard";

interface CharacterBuildCardProps {
  character: CharacterDefinition;
  ownedCharacter?: Character;
  equippedLightConeDefinitionId?: string;
  builds: readonly BuildConfiguration[];
  profiles: ReadonlyMap<string, ScoreProfile>;
  references: BuildReferences;
  onAddBuild: () => void;
  onBuildChange: (build: BuildConfiguration) => void;
  onProfileChange: (profile: ScoreProfile) => void;
  onDeleteBuild: (build: BuildConfiguration) => void;
}

export function CharacterBuildCard({
  character,
  ownedCharacter,
  equippedLightConeDefinitionId,
  builds,
  profiles,
  references,
  onAddBuild,
  onBuildChange,
  onProfileChange,
  onDeleteBuild,
}: CharacterBuildCardProps) {
  const { locale, t } = useI18n();
  const presentation = characterCatalogPresentation(
    character,
    references.properties,
    locale,
    t("terms.trailblazer")
  );
  const lightCone = equippedLightConeDefinitionId
    ? references.lightCones.byId.get(equippedLightConeDefinitionId)
    : undefined;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/45 shadow-sm">
      <header className="flex min-w-0 items-center gap-3 border-b border-border/60 bg-gradient-select p-3">
        <AssetImage
          kind="character"
          id={character.id}
          sourcePath={character.icon_path}
          alt={presentation.name}
          className="h-16 w-16 shrink-0 rounded-lg bg-background/70 object-contain object-top"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">
            {presentation.name}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{presentation.combatTypeName}</Badge>
            <Badge variant="outline">{character.rarity} ★</Badge>
            <Badge variant="outline">{presentation.pathName}</Badge>
            {ownedCharacter && (
              <Badge variant="secondary">{t("build.owned")}</Badge>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {lightCone ? (
            <AssetImage
              kind="light-cone"
              id={lightCone.id}
              sourcePath={lightCone.icon_path}
              alt=""
              className="h-16 w-14 rounded-lg bg-background/70 object-contain"
            />
          ) : (
            <span className="flex h-16 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </header>

      <div className="space-y-3 p-3">
        {builds.map((build) => {
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
        })}
        <Button
          type="button"
          variant="secondary"
          className="h-9 w-full"
          onClick={onAddBuild}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {builds.length === 0 ? t("build.addFirstBuild") : t("build.addBuild")}
        </Button>
      </div>
    </section>
  );
}
