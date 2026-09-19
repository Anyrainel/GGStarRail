import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  CharacterDefinition,
  CharacterEnhancementVariant,
  CharacterRank,
  CharacterTrace,
  PropertyCatalog,
} from "@/providers/gilore/types";
import {
  type CharacterDescriptionMode,
  CharacterEffectCard,
  CharacterSection,
  CharacterSkillCard,
} from "./CharacterSkillCard";
import { CurrencyWarText, currencyWarSearchText } from "./CurrencyWarDetails";

export function characterExtendedSearchText(
  character: CharacterDefinition
): string {
  return currencyWarSearchText([
    character.skills,
    character.ranks,
    character.traces,
    character.servants,
    character.enhancements,
  ]);
}

function RankCards({ ranks }: { ranks: readonly CharacterRank[] }) {
  const { locale, t } = useI18n();
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {ranks.map((rank) => (
        <CharacterEffectCard
          key={rank.id}
          rankId={rank.id}
          title={
            <>
              <span className="mr-2 text-primary">
                {t("archive.eidolon", { value: rank.rank })}
              </span>{" "}
              {formatGameText(getLocalizedValue(rank.name, locale))}
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
  );
}

function visibleTraces(traces: readonly CharacterTrace[]) {
  return traces.filter((trace) =>
    Boolean(
      trace.description?.en.value ||
        trace.description?.["zh-CN"].value ||
        trace.levels.some((level) => level.properties.length)
    )
  );
}

function TraceCards({
  traces,
  propertyTables,
}: {
  traces: readonly CharacterTrace[];
  propertyTables: PropertyCatalog;
}) {
  const { locale } = useI18n();
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {visibleTraces(traces).map((trace) => {
        const level = trace.levels.at(-1);
        const values =
          level?.properties.flatMap((value) => {
            const property = propertyTables.propertyById.get(value.property_id);
            return property
              ? [
                  {
                    name: getLocalizedValue(
                      property.relic_name ?? property.name,
                      locale
                    ),
                    value: formatCatalogValue(value.value, property.value_kind),
                  },
                ]
              : [];
          }) ?? [];
        const title =
          getLocalizedValue(trace.name, locale) ||
          values.map((value) => value.name).join(" · ");
        if (!title) return null;
        return (
          <CharacterEffectCard
            key={trace.id}
            traceId={trace.id}
            title={formatGameText(title)}
          >
            <CurrencyWarText
              text={trace.description}
              parameters={level?.parameters}
            />
            {values.length > 0 && (
              <dl className="space-y-1">
                {values.map((value) => (
                  <div
                    key={value.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <dt>{value.name}</dt>
                    <dd className="font-semibold tabular-nums text-primary">
                      {value.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CharacterEffectCard>
        );
      })}
    </div>
  );
}

function EnhancementDetails({
  variants,
  propertyTables,
  descriptionMode,
}: {
  variants: readonly CharacterEnhancementVariant[];
  propertyTables: PropertyCatalog;
  descriptionMode: CharacterDescriptionMode;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const variant = variants[selected] ?? variants[0];
  if (!variant) return null;
  return (
    <CharacterSection
      testId="character-enhancements"
      title={t("archive.seasonalEnhancements", { value: variants.length })}
    >
      {variants.length > 1 && (
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          aria-label={t("archive.seasonalEnhancements", {
            value: variants.length,
          })}
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {variants.map((entry, index) => (
            <option key={entry.enhanced_id} value={index}>
              {t("archive.currencyWar.seasonNumber", {
                value: entry.season_id,
              })}
            </option>
          ))}
        </select>
      )}
      <div
        data-testid={`enhancement-variant-${variant.enhanced_id}`}
        className="space-y-4"
      >
        {variant.summaries.map((summary) => (
          <CurrencyWarText key={summary.en.value} text={summary} />
        ))}
        <div className="space-y-3">
          {variant.skills
            .filter((skill) => !skill.hide_in_ui)
            .map((skill) => (
              <CharacterSkillCard
                key={skill.id}
                skill={skill}
                descriptionMode={descriptionMode}
              />
            ))}
        </div>
        {variant.ranks.length > 0 && (
          <section className="space-y-2">
            <h4 className="font-semibold">
              {t("archive.eidolons", { value: variant.ranks.length })}
            </h4>
            <RankCards ranks={variant.ranks} />
          </section>
        )}
        {visibleTraces(variant.traces).length > 0 && (
          <section className="space-y-2">
            <h4 className="font-semibold">
              {t("archive.traceTree", {
                nodes: visibleTraces(variant.traces).length,
              })}
            </h4>
            <TraceCards
              traces={variant.traces}
              propertyTables={propertyTables}
            />
          </section>
        )}
      </div>
    </CharacterSection>
  );
}

export function CharacterExtendedDetails({
  character,
  propertyTables,
  descriptionMode,
}: {
  character: CharacterDefinition;
  propertyTables: PropertyCatalog;
  descriptionMode: CharacterDescriptionMode;
}) {
  const { locale, t } = useI18n();
  const skills = character.skills.filter((skill) => !skill.hide_in_ui);
  const traces = visibleTraces(character.traces);
  return (
    <>
      {skills.length > 0 && (
        <CharacterSection
          testId="character-base-skills"
          title={t("archive.baseSkills", { skills: skills.length })}
        >
          {skills.map((skill) => (
            <CharacterSkillCard
              key={skill.id}
              skill={skill}
              descriptionMode={descriptionMode}
            />
          ))}
        </CharacterSection>
      )}
      {character.servants.length > 0 && (
        <CharacterSection
          testId="character-servants"
          title={t("archive.servants", { servants: character.servants.length })}
        >
          {character.servants.map((servant) => (
            <section
              key={servant.id}
              data-servant-id={servant.id}
              className="space-y-3"
            >
              <h4 className="text-sm font-semibold text-primary">
                {formatGameText(
                  getLocalizedValue(servant.name, locale),
                  [],
                  t("terms.trailblazer")
                )}
              </h4>
              {servant.skills
                .filter((skill) => !skill.hide_in_ui)
                .map((skill) => (
                  <CharacterSkillCard
                    key={skill.id}
                    skill={skill}
                    descriptionMode={descriptionMode}
                  />
                ))}
            </section>
          ))}
        </CharacterSection>
      )}
      {traces.length > 0 && (
        <CharacterSection
          testId="character-traces"
          title={t("archive.traceTree", { nodes: traces.length })}
        >
          <TraceCards traces={traces} propertyTables={propertyTables} />
        </CharacterSection>
      )}
      {character.ranks.length > 0 && (
        <CharacterSection
          testId="character-eidolons"
          title={t("archive.eidolons", { value: character.ranks.length })}
        >
          <RankCards ranks={character.ranks} />
        </CharacterSection>
      )}
      {character.enhancements.length > 0 && (
        <EnhancementDetails
          variants={character.enhancements}
          propertyTables={propertyTables}
          descriptionMode={descriptionMode}
        />
      )}
    </>
  );
}
