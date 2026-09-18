import { Coins } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue, loadLightCones } from "@/providers/gilore/catalog";
import { loadCurrencyWarCatalog } from "@/providers/gilore/currencyWar";
import type {
  CurrencyWarCharacter,
  CurrencyWarSkill,
  PropertyCatalog,
} from "@/providers/gilore/types";
import { CatalogFailure, CatalogLoading } from "./CatalogControls";
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

function CurrencyWarSkillDetails({ skill }: { skill: CurrencyWarSkill }) {
  const { locale, t } = useI18n();
  const [level, setLevel] = useState(skill.levels[0]?.level ?? skill.level);
  const skillLevel = skill.levels.find((entry) => entry.level === level);
  return (
    <details className="rounded-lg border border-border bg-background/45 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {formatGameText(
          getLocalizedValue(skill.name, locale),
          [],
          t("terms.trailblazer")
        )}
        {skill.tag && (
          <span className="ml-2 text-xs text-muted-foreground">
            {getLocalizedValue(skill.tag, locale)}
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-2">
        {skill.levels.length > 1 && (
          <label className="flex items-center gap-2 text-xs">
            {t("archive.currencyWar.skillLevel")}
            <select
              className="h-8 rounded-md border border-border bg-background px-2"
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
            >
              {skill.levels.map((entry) => (
                <option key={entry.level} value={entry.level}>
                  {t("archive.level", { value: entry.level })}
                </option>
              ))}
            </select>
          </label>
        )}
        <CurrencyWarText
          text={skill.description}
          parameters={skillLevel?.parameters ?? skill.parameters}
        />
        <CurrencyWarText
          text={skill.condition_description}
          parameters={skill.condition_parameters}
          className="text-muted-foreground"
        />
      </div>
    </details>
  );
}

export function CharacterCurrencyWarDetails({
  variants,
  properties,
}: {
  variants: readonly CurrencyWarCharacter[];
  properties: PropertyCatalog;
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
    <section
      data-testid="character-currency-war"
      className="space-y-4 rounded-xl border border-primary/35 bg-primary/5 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("archive.currencyWar.title")}
        </h3>
        <Badge variant="secondary">
          {t("archive.currencyWar.cost", { value: role.rarity })}
        </Badge>
        {role.is_expert && <Badge>{t("archive.currencyWar.expert")}</Badge>}
      </div>
      {variants.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {t("archive.currencyWar.season")}
          <select
            className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm"
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
                {variant.is_expert
                  ? ` · ${t("archive.currencyWar.expert")}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
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
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/60"
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
          className="flex rounded-lg border border-border bg-background/65 p-1"
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
            <Badge key={tag.en.provenance.source_reference} variant="outline">
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
            <CurrencyWarSkillDetails key={skill.id} skill={skill} />
          ))}
          {position === "Front" && starLevel.servant_skills.length > 0 && (
            <CurrencyWarSection
              title={t("archive.servants", {
                servants: starLevel.servant_skills.length,
              })}
            >
              {starLevel.servant_skills.map((skill) => (
                <CurrencyWarSkillDetails key={skill.id} skill={skill} />
              ))}
            </CurrencyWarSection>
          )}
        </div>
      )}
      {role.ranks.length > 0 && (
        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {t("archive.currencyWar.eidolons")}
          </summary>
          <div className="mt-3 space-y-4">
            {role.ranks.map((rank) => (
              <CurrencyWarSection
                key={rank.id}
                title={`E${rank.rank} · ${getLocalizedValue(rank.name, locale)}`}
              >
                <CurrencyWarText
                  text={rank.description}
                  parameters={rank.parameters}
                />
              </CurrencyWarSection>
            ))}
          </div>
        </details>
      )}
      {role.special_effects?.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.adaptations")}>
          <div className="space-y-2">
            {role.special_effects.map((effect) => (
              <details
                key={effect.id}
                className="rounded-lg border border-border bg-background/45 p-3"
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {getLocalizedValue(effect.name, locale)}
                </summary>
                <div className="mt-3 space-y-2">
                  {effect.cost > 0 && (
                    <Badge variant="secondary">
                      {t("archive.currencyWar.cost", { value: effect.cost })}
                    </Badge>
                  )}
                  <CurrencyWarText
                    text={effect.description}
                    parameters={effect.parameters}
                  />
                </div>
              </details>
            ))}
          </div>
        </CurrencyWarSection>
      )}
      {role.light_cone_adaptations.length > 0 && (
        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {t("archive.currencyWar.lightCones")}
          </summary>
          <div className="mt-3 space-y-4">
            {role.light_cone_adaptations.map((adaptation) => {
              const lightCone = references.data?.lightCones.byId.get(
                adaptation.light_cone_id
              );
              return (
                <CurrencyWarSection
                  key={`${adaptation.light_cone_id}-${adaptation.level}`}
                  title={`${lightCone ? getLocalizedValue(lightCone.name, locale) : t("nav.archiveLightCones")} · ${t("archive.superimposition", { value: adaptation.level })}`}
                >
                  <CurrencyWarText
                    text={adaptation.description}
                    parameters={adaptation.parameters}
                    parameterFormat={adaptation.parameter_format}
                  />
                </CurrencyWarSection>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
