import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { getLocalizedValue, loadLightCones } from "@/providers/gilore/catalog";
import { loadCurrencyWarCatalog } from "@/providers/gilore/currencyWar";
import type {
  CurrencyWarCharacter,
  PropertyCatalog,
} from "@/providers/gilore/types";
import { CatalogFailure, CatalogLoading } from "./CatalogStatus";
import {
  type CharacterDescriptionMode,
  CharacterEffectCard,
  CharacterSection,
  CharacterSkillCard,
} from "./CharacterSkillCard";
import { CurrencyWarCharacterStats } from "./CurrencyWarCharacterStats";
import {
  CurrencyWarProperties,
  CurrencyWarSection,
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
}: {
  variants: readonly CurrencyWarCharacter[];
  properties: PropertyCatalog;
  descriptionMode: CharacterDescriptionMode;
}) {
  const { locale, t } = useI18n();
  const references = useCatalogResource(loadCurrencyWarReferences);
  const [variantIndex, setVariantIndex] = useState(0);
  const role = variants[variantIndex] ?? variants[0];
  const [star, setStar] = useState(role?.star_levels[0]?.star ?? 1);
  const [selectedPosition, setPosition] = useState<"Front" | "Back">(
    role?.preferred_position === "Back" ? "Back" : "Front"
  );
  if (!role) return null;
  const starLevel =
    role.star_levels.find((entry) => entry.star === star) ??
    role.star_levels[0];
  const availablePositions = (["Front", "Back"] as const).filter((value) =>
    value === "Front"
      ? Boolean(
          starLevel?.front_description ||
            starLevel?.front_skills.length ||
            starLevel?.servant_skills.length
        )
      : Boolean(starLevel?.back_description || starLevel?.back_skills.length)
  );
  const position = availablePositions.includes(selectedPosition)
    ? selectedPosition
    : (availablePositions[0] ?? selectedPosition);
  const positionInfo = role.positions.find(
    (entry) => entry.position === position
  );
  const skills =
    position === "Front" ? starLevel?.front_skills : starLevel?.back_skills;
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
          <select
            className="ml-auto h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm"
            aria-label={t("archive.currencyWar.season")}
            value={variantIndex}
            onChange={(event) => {
              const index = Number(event.target.value);
              setVariantIndex(index);
              setPosition(
                variants[index].preferred_position === "Back" ? "Back" : "Front"
              );
            }}
          >
            {variants.map((variant, index) => (
              <option value={index} key={variant.id}>
                {variant.season_ids.length
                  ? variant.season_ids
                      .map((season) =>
                        t("archive.currencyWar.seasonNumber", { value: season })
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
              </option>
            ))}
          </select>
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
        <fieldset
          className="flex flex-wrap gap-1"
          aria-label={t("archive.currencyWar.starRank")}
        >
          {role.star_levels.map((entry) => (
            <Button
              key={entry.star}
              variant={entry.star === starLevel?.star ? "secondary" : "outline"}
              size="sm"
              aria-pressed={entry.star === starLevel?.star}
              onClick={() => setStar(entry.star)}
            >
              {t("archive.currencyWar.starLevel", { value: entry.star })}
            </Button>
          ))}
        </fieldset>
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
      {starLevel && (
        <div className="space-y-3">
          <CurrencyWarText
            text={
              position === "Front"
                ? starLevel.front_description
                : starLevel.back_description
            }
          />
          <CurrencyWarProperties
            values={starLevel.properties}
            properties={properties}
          />
          <CurrencyWarCharacterStats
            starLevel={starLevel}
            position={position}
            chargeTypes={role.charge_types}
          />
          {skills?.map((skill) => (
            <CharacterSkillCard
              key={`${role.id}-${position}-${starLevel.star}-${skill.id}`}
              skill={skill}
              descriptionMode={descriptionMode}
            />
          ))}
          {position === "Front" && starLevel.servant_skills.length > 0 && (
            <CurrencyWarSection
              title={t("archive.servants", {
                servants: starLevel.servant_skills.length,
              })}
            >
              {starLevel.servant_skills.map((skill) => (
                <CharacterSkillCard
                  key={`${role.id}-${starLevel.star}-${skill.id}`}
                  skill={skill}
                  descriptionMode={descriptionMode}
                />
              ))}
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
            {role.light_cone_adaptations.map((adaptation) => {
              const lightCone = references.data?.lightCones.byId.get(
                adaptation.light_cone_id
              );
              return (
                <CharacterEffectCard
                  key={`${adaptation.light_cone_id}-${adaptation.level}`}
                  title={`${lightCone ? getLocalizedValue(lightCone.name, locale) : t("nav.archiveLightCones")} · ${t("archive.superimposition", { value: adaptation.level })}`}
                >
                  <CurrencyWarText
                    text={adaptation.description}
                    parameters={adaptation.parameters}
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
