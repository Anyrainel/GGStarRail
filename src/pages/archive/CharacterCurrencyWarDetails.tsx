import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import {
  currencyWarSkillGroups,
  currencyWarSkillLevelCaps,
  currencyWarTextGroups,
} from "@/lib/currencyWarPresentation";
import {
  getLocalizedValue,
  loadLightCones,
} from "@/providers/reference/catalog";
import { loadCurrencyWarCatalog } from "@/providers/reference/currencyWar";
import type {
  CharacterSkill,
  CurrencyWarCharacter,
  CurrencyWarLightConeAdaptation,
  PropertyCatalog,
} from "@/providers/reference/types";
import { CatalogFailure, CatalogLoading } from "./CatalogStatus";
import {
  type CharacterDescriptionMode,
  CharacterEffectCard,
  CharacterSection,
  CharacterSkillCard,
} from "./CharacterSkillCard";
import { CurrencyWarCharacterStats } from "./CurrencyWarCharacterStats";
import {
  CurrencyWarSection,
  CurrencyWarStarProperties,
  CurrencyWarText,
} from "./CurrencyWarDetails";

async function loadCurrencyWarReferences() {
  const [catalog, lightCones] = await Promise.all([
    loadCurrencyWarCatalog(),
    loadLightCones(),
  ]);
  return { bonds: catalog.bonds, lightCones };
}

export function CharacterCurrencyWarDetails({
  variants,
  properties,
  descriptionMode,
  characterSkills = [],
}: {
  variants: readonly CurrencyWarCharacter[];
  properties: PropertyCatalog;
  descriptionMode: CharacterDescriptionMode;
  characterSkills?: readonly CharacterSkill[];
}) {
  const { locale, t } = useI18n();
  const references = useCatalogResource(loadCurrencyWarReferences);
  const [variantIndex, setVariantIndex] = useState(0);
  const role = variants[variantIndex] ?? variants[0];
  const [selectedPosition, setPosition] = useState<"Front" | "Back">(
    role?.preferred_position === "Back" ? "Back" : "Front"
  );
  if (!role) return null;
  const stars = role.star_levels;
  const availablePositions = (["Front", "Back"] as const).filter((value) =>
    stars.some((starLevel) =>
      value === "Front"
        ? Boolean(
            starLevel?.front_description ||
              starLevel?.front_skills.length ||
              starLevel?.servant_skills.length
          )
        : Boolean(starLevel?.back_description || starLevel?.back_skills.length)
    )
  );
  const position = availablePositions.includes(selectedPosition)
    ? selectedPosition
    : (availablePositions[0] ?? selectedPosition);
  const positionInfo = role.positions.find(
    (entry) => entry.position === position
  );
  const skills = currencyWarSkillGroups(
    stars,
    position === "Front" ? "front_skills" : "back_skills"
  );
  const servants = currencyWarSkillGroups(stars, "servant_skills");
  const descriptions = currencyWarTextGroups(
    stars,
    position === "Front" ? "front_description" : "back_description"
  );
  const lightConeGroups = new Map<string, CurrencyWarLightConeAdaptation[]>();
  for (const adaptation of role.light_cone_adaptations) {
    const key = JSON.stringify([
      adaptation.light_cone_id,
      adaptation.description,
      adaptation.parameter_format,
    ]);
    const group = lightConeGroups.get(key) ?? [];
    group.push(adaptation);
    lightConeGroups.set(key, group);
  }
  const renderSkill = (
    group: ReturnType<typeof currencyWarSkillGroups>[number]
  ) => {
    const caps = currencyWarSkillLevelCaps(group.skill, characterSkills);
    return (
      <CharacterSkillCard
        key={`${role.id}-${position}-${group.key}`}
        descriptionMode={descriptionMode}
        skill={{
          ...group.skill,
          ...caps,
          levels: group.skill.levels.filter(
            (level) => level.level <= caps.max_level
          ),
        }}
        comparisonVariants={group.variants.map(({ star, skill }) => ({
          label: `${star}★`,
          levels: skill.levels,
          condition_parameters: skill.condition_parameters,
        }))}
      />
    );
  };
  return (
    <CharacterSection
      testId="character-currency-war"
      title={t("archive.currencyWar.title")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("archive.currencyWar.cost", { value: role.rarity })}
        </Badge>
        {role.is_expert && <Badge>{t("archive.currencyWar.expert")}</Badge>}
        {variants.length > 1 && (
          <LightweightSelect
            value={String(variantIndex)}
            onValueChange={(value) => {
              const index = Number(value);
              setVariantIndex(index);
              setPosition(
                variants[index].preferred_position === "Back" ? "Back" : "Front"
              );
            }}
          >
            <LightweightSelectTrigger
              className="ml-auto h-8 w-auto max-w-full bg-gradient-select text-xs"
              aria-label={t("archive.currencyWar.season")}
            >
              <LightweightSelectValue />
            </LightweightSelectTrigger>
            <LightweightSelectContent collisionPadding={8}>
              {variants.map((variant, index) => (
                <LightweightSelectItem value={String(index)} key={variant.id}>
                  {variant.season_ids.length
                    ? variant.season_ids
                        .map((season) =>
                          t("archive.currencyWar.seasonNumber", {
                            value: season,
                          })
                        )
                        .join(" / ")
                    : t("archive.currencyWar.standard")}
                  {" · "}
                  {t("archive.currencyWar.cost", { value: variant.rarity })}
                  {variant.bond_ids
                    .flatMap((id) => {
                      if (
                        variants.every((candidate) =>
                          candidate.bond_ids.includes(id)
                        )
                      )
                        return [];
                      const bond = references.data?.bonds.find(
                        (candidate) => candidate.id === id
                      );
                      return bond
                        ? [` · ${getLocalizedValue(bond.name, locale)}`]
                        : [];
                    })
                    .join("")}
                  {variant.is_expert
                    ? ` · ${t("archive.currencyWar.expert")}`
                    : ""}
                </LightweightSelectItem>
              ))}
            </LightweightSelectContent>
          </LightweightSelect>
        )}
      </div>
      {references.error ? (
        <CatalogFailure error={references.error} />
      ) : !references.data ? (
        <CatalogLoading />
      ) : (
        <div className="flex flex-wrap gap-2">
          {role.bond_ids.map((id) => {
            const bond = references.data?.bonds.find(
              (entry) => entry.id === id
            );
            return bond ? (
              <Link
                key={id}
                to={`${APP_PATHS.archiveCurrencyWar}?tab=bonds&id=${id}`}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/20"
              >
                {getLocalizedValue(bond.name, locale)}
              </Link>
            ) : null;
          })}
        </div>
      )}
      <CurrencyWarText text={role.remark} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset
          className="flex rounded-lg border border-border bg-secondary/40 p-1"
          aria-label={t("archive.currencyWar.position")}
        >
          {availablePositions.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={position === value ? "default" : "ghost"}
              aria-pressed={position === value}
              onClick={() => setPosition(value)}
            >
              {value === "Front"
                ? t("archive.currencyWar.frontRow")
                : t("archive.currencyWar.backRow")}
            </Button>
          ))}
        </fieldset>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {stars.map((star) => `${star.star}★`).join(" / ")}
        </span>
      </div>
      {positionInfo && (
        <div className="flex flex-wrap gap-2">
          {positionInfo.tag_names.map((tag) => (
            <Badge key={tag.en.value} variant="outline">
              {getLocalizedValue(tag, locale)}
            </Badge>
          ))}
        </div>
      )}
      {stars.length > 0 && (
        <div className="space-y-3">
          {descriptions.map((group) => (
            <div key={group.stars.join("-")}>
              {descriptions.length > 1 && (
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {group.stars.map((star) => `${star}★`).join(" / ")}
                </p>
              )}
              <CurrencyWarText text={group.text} />
            </div>
          ))}
          <CurrencyWarStarProperties stars={stars} properties={properties} />
          <CurrencyWarCharacterStats
            starLevels={stars}
            position={position}
            chargeTypes={role.charge_types}
          />
          {skills.map(renderSkill)}
          {position === "Front" && servants.length > 0 && (
            <CurrencyWarSection
              title={t("archive.servants", {
                servants: servants.length,
              })}
            >
              {servants.map(renderSkill)}
            </CurrencyWarSection>
          )}
        </div>
      )}
      {role.ranks.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.eidolons")}>
          <div className="grid gap-3 xl:grid-cols-2">
            {role.ranks.map((rank) => (
              <CharacterEffectCard
                key={rank.id}
                title={
                  <>
                    <span className="mr-2 text-primary">
                      {t("archive.eidolon", { value: rank.rank })}
                    </span>{" "}
                    {getLocalizedValue(rank.name, locale)}
                  </>
                }
              >
                <CurrencyWarText
                  text={rank.description}
                  parameters={rank.parameters}
                />
              </CharacterEffectCard>
            ))}
          </div>
        </CurrencyWarSection>
      )}
      {role.special_effects.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.adaptations")}>
          <div className="grid gap-3 xl:grid-cols-2">
            {role.special_effects.map((effect) => (
              <CharacterEffectCard
                key={effect.id}
                title={getLocalizedValue(effect.name, locale)}
              >
                <CurrencyWarText
                  text={
                    descriptionMode === "short"
                      ? (effect.simple_description ?? effect.description)
                      : effect.description
                  }
                  parameters={effect.parameters}
                />
              </CharacterEffectCard>
            ))}
          </div>
        </CurrencyWarSection>
      )}
      {role.light_cone_adaptations.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.lightCones")}>
          <div className="grid gap-3 xl:grid-cols-2">
            {[...lightConeGroups.entries()].map(([key, adaptations]) => {
              const adaptation = adaptations[0];
              const lightCone = references.data?.lightCones.byId.get(
                adaptation.light_cone_id
              );
              return (
                <CharacterEffectCard
                  key={key}
                  title={`${lightCone ? getLocalizedValue(lightCone.name, locale) : t("nav.archiveLightCones")} · ${t("archive.superimposition", { value: adaptations.map((entry) => entry.level).join("/") })}`}
                >
                  <CurrencyWarText
                    text={adaptation.description}
                    parameters={adaptation.parameters}
                    parameterVariants={adaptations}
                    parameterFormat={adaptation.parameter_format}
                  />
                </CharacterEffectCard>
              );
            })}
          </div>
        </CurrencyWarSection>
      )}
    </CharacterSection>
  );
}
