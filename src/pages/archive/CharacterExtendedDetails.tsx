import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  CharacterDefinitionV1_1,
  CharacterEnhancementVariant,
  CharacterRank,
  CharacterSkillV1_1,
  CharacterTrace,
  LocalizedText,
  ProgressionItem,
  PropertyCatalogV1_1,
  ReferenceLocale,
} from "@/providers/gilore/types";
import {
  createProgressionItemIndex,
  ExperienceItemSection,
  MaterialCosts,
  ParameterValues,
  type ProgressionItemIndex,
  PropertyValues,
} from "./ProgressionDetails";

function addLocalizedText(
  values: string[],
  text: LocalizedText | null | undefined
) {
  if (!text) return;
  values.push(text.en.value, text["zh-CN"].value);
}

function addSkillSearchValues(values: string[], skill: CharacterSkillV1_1) {
  values.push(
    skill.id,
    skill.source_table,
    skill.attack_type,
    skill.effect_type,
    skill.trigger_key,
    ...skill.rated_trace_ids,
    ...skill.rated_rank_ids,
    ...skill.extra_effect_ids,
    ...skill.simple_extra_effect_ids
  );
  addLocalizedText(values, skill.name);
  addLocalizedText(values, skill.tag);
  addLocalizedText(values, skill.type_description);
  addLocalizedText(values, skill.description);
  addLocalizedText(values, skill.simple_description);
  addLocalizedText(values, skill.display_description);
}

function addRankSearchValues(values: string[], rank: CharacterRank) {
  values.push(
    rank.id,
    ...Object.keys(rank.skill_level_additions),
    ...rank.extra_effect_ids,
    ...rank.ability_names
  );
  addLocalizedText(values, rank.name);
  addLocalizedText(values, rank.description);
}

function addTraceSearchValues(values: string[], trace: CharacterTrace) {
  values.push(
    trace.id,
    trace.anchor_type,
    trace.trigger_key,
    ...(trace.ability_name ? [trace.ability_name] : []),
    ...trace.prerequisite_ids,
    ...trace.skill_ids,
    ...trace.extra_effect_ids,
    ...trace.simple_extra_effect_ids
  );
  addLocalizedText(values, trace.name);
  addLocalizedText(values, trace.description);
}

/** Both locales and canonical IDs for details that are intentionally collapsed. */
export function characterExtendedSearchText(
  character: CharacterDefinitionV1_1
): string {
  const values: string[] = [];
  for (const skill of character.skills) addSkillSearchValues(values, skill);
  for (const rank of character.ranks) addRankSearchValues(values, rank);
  for (const trace of character.traces) addTraceSearchValues(values, trace);
  for (const servant of character.servants) {
    values.push(servant.id);
    addLocalizedText(values, servant.name);
    for (const skill of servant.skills) addSkillSearchValues(values, skill);
  }
  for (const variant of character.enhancements) {
    values.push(
      String(variant.enhanced_id),
      String(variant.season_id),
      String(variant.activity_id)
    );
    for (const summary of variant.summaries) addLocalizedText(values, summary);
    for (const skill of variant.skills) addSkillSearchValues(values, skill);
    for (const rank of variant.ranks) addRankSearchValues(values, rank);
    for (const trace of variant.traces) addTraceSearchValues(values, trace);
    for (const change of variant.skill_changes) {
      values.push(change.skill_id, change.trace_id);
      addLocalizedText(values, change.simple_description_before);
      addLocalizedText(values, change.simple_description_after);
      addLocalizedText(values, change.description_before);
      addLocalizedText(values, change.description_after);
    }
    for (const change of variant.trace_changes) {
      values.push(change.trace_id);
      addLocalizedText(values, change.description_before);
      addLocalizedText(values, change.description_after);
    }
    for (const change of variant.rank_changes) {
      values.push(change.rank_id);
      addLocalizedText(values, change.description_before);
      addLocalizedText(values, change.description_after);
    }
  }
  return values.join(" ");
}

function localizedText(
  text: LocalizedText,
  locale: ReferenceLocale,
  parameters: readonly number[] = [],
  trailblazer: string
): string {
  return formatGameText(
    getLocalizedValue(text, locale),
    parameters,
    trailblazer
  );
}

function SkillRecord({
  skill,
  itemById,
}: {
  skill: CharacterSkillV1_1;
  itemById: ProgressionItemIndex;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  const firstLevel = skill.levels[0];
  const displayParameters =
    firstLevel?.display_parameters ?? firstLevel?.parameters ?? [];
  const displayDescription = localizedText(
    skill.display_description,
    locale,
    displayParameters,
    trailblazer
  );
  const fullDescription = localizedText(
    skill.description,
    locale,
    firstLevel?.parameters ?? [],
    trailblazer
  );
  const tag = skill.tag
    ? localizedText(skill.tag, locale, [], trailblazer)
    : null;
  const typeDescription = skill.type_description
    ? localizedText(skill.type_description, locale, [], trailblazer)
    : null;

  return (
    <details
      data-skill-id={skill.id}
      className="rounded-lg border border-border bg-background/45 p-3"
    >
      <summary className="cursor-pointer font-medium">
        {localizedText(skill.name, locale, [], trailblazer)}
        <span className="ml-2 text-xs text-muted-foreground">
          {skill.attack_type}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <code>{skill.id}</code>
          <Badge variant="outline">{skill.source_table}</Badge>
          {tag && <Badge variant="secondary">{tag}</Badge>}
          {typeDescription && <span>{typeDescription}</span>}
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {displayDescription}
        </p>
        <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs leading-5 text-muted-foreground">
          {skill.display_description_source === "simple_description"
            ? t("archive.skillSource.simple")
            : t("archive.skillSource.fallback")}
        </p>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.fullDescription")}
          </summary>
          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">
            {fullDescription}
          </p>
        </details>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.levelRows", { value: skill.levels.length })}
          </summary>
          <div className="mt-2 space-y-2">
            {skill.levels.map((level) => (
              <div
                key={level.level}
                className="space-y-2 rounded-md bg-secondary/35 p-2"
              >
                <p className="text-xs font-semibold">
                  {t("archive.level", { value: level.level })}
                </p>
                <ParameterValues values={level.parameters} />
                <ParameterValues
                  values={level.display_parameters}
                  kind="display"
                />
                <ParameterValues
                  values={level.simple_parameters}
                  kind="simple"
                />
                <MaterialCosts
                  costs={level.level_up_costs}
                  itemById={itemById}
                />
              </div>
            ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function SkillCollection({
  skills,
  itemById,
}: {
  skills: readonly CharacterSkillV1_1[];
  itemById: ProgressionItemIndex;
}) {
  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <SkillRecord key={skill.id} skill={skill} itemById={itemById} />
      ))}
    </div>
  );
}

function RankRecord({
  rank,
  itemById,
}: {
  rank: CharacterRank;
  itemById: ProgressionItemIndex;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  const additions = Object.entries(rank.skill_level_additions);
  return (
    <details
      data-rank-id={rank.id}
      className="rounded-lg border border-border bg-background/45 p-3"
    >
      <summary className="cursor-pointer font-medium">
        {t("archive.eidolon", { value: rank.rank })} ·{" "}
        {localizedText(rank.name, locale, [], trailblazer)}
      </summary>
      <div className="mt-3 space-y-3">
        <code className="block text-xs text-muted-foreground">{rank.id}</code>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {localizedText(
            rank.description,
            locale,
            rank.parameters,
            trailblazer
          )}
        </p>
        <ParameterValues values={rank.parameters} />
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("archive.unlockCosts")}</p>
          <MaterialCosts
            costs={rank.unlock_costs}
            itemById={itemById}
            showHeading={false}
          />
        </div>
        {additions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">
              {t("archive.skillLevelAdditions")}
            </p>
            <div className="flex flex-wrap gap-2">
              {additions.map(([skillId, level]) => (
                <Badge key={skillId} variant="outline">
                  <code>{skillId}</code> +{level}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function RankCollection({
  ranks,
  itemById,
}: {
  ranks: readonly CharacterRank[];
  itemById: ProgressionItemIndex;
}) {
  return (
    <div className="space-y-2">
      {ranks.map((rank) => (
        <RankRecord key={rank.id} rank={rank} itemById={itemById} />
      ))}
    </div>
  );
}

function TraceRecord({
  trace,
  itemById,
  propertyTables,
}: {
  trace: CharacterTrace;
  itemById: ProgressionItemIndex;
  propertyTables: PropertyCatalogV1_1;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  const firstLevel = trace.levels[0];
  const name = trace.name
    ? localizedText(trace.name, locale, [], trailblazer)
    : t("archive.traceNode", { value: trace.id });
  const description = trace.description
    ? localizedText(
        trace.description,
        locale,
        firstLevel?.parameters ?? [],
        trailblazer
      )
    : t("archive.sourceValueMissing");
  return (
    <details
      data-trace-id={trace.id}
      className="rounded-lg border border-border bg-background/45 p-3"
    >
      <summary className="cursor-pointer font-medium">
        {name}
        <span className="ml-2 text-xs text-muted-foreground">{trace.id}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{trace.anchor_type}</Badge>
          {trace.default_unlock && (
            <Badge variant="secondary">{t("archive.defaultUnlocked")}</Badge>
          )}
          {trace.ability_name && <code>{trace.ability_name}</code>}
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {trace.prerequisite_ids.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">{t("archive.prerequisites")}</p>
            <p className="break-words font-mono text-xs text-muted-foreground">
              {trace.prerequisite_ids.join(" · ")}
            </p>
          </div>
        )}
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.levelRows", { value: trace.levels.length })}
          </summary>
          <div className="mt-2 space-y-2">
            {trace.levels.map((level) => (
              <div
                key={level.level}
                className="space-y-2 rounded-md bg-secondary/35 p-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">
                    {t("archive.level", { value: level.level })}
                  </span>
                  {level.promotion_required !== null && (
                    <Badge variant="outline">
                      {t("archive.promotionRequired", {
                        value: level.promotion_required,
                      })}
                    </Badge>
                  )}
                  {level.character_level_required !== null && (
                    <Badge variant="outline">
                      {t("archive.characterLevelRequired", {
                        value: level.character_level_required,
                      })}
                    </Badge>
                  )}
                </div>
                <ParameterValues values={level.parameters} />
                <PropertyValues
                  values={level.properties}
                  propertyTables={propertyTables}
                />
                <MaterialCosts costs={level.costs} itemById={itemById} />
              </div>
            ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function TraceCollection({
  traces,
  itemById,
  propertyTables,
}: {
  traces: readonly CharacterTrace[];
  itemById: ProgressionItemIndex;
  propertyTables: PropertyCatalogV1_1;
}) {
  return (
    <div className="space-y-2">
      {traces.map((trace) => (
        <TraceRecord
          key={trace.id}
          trace={trace}
          itemById={itemById}
          propertyTables={propertyTables}
        />
      ))}
    </div>
  );
}

function ChangePair({
  before,
  after,
  beforeParameters = [],
  afterParameters = [],
}: {
  before: LocalizedText;
  after: LocalizedText;
  beforeParameters?: readonly number[];
  afterParameters?: readonly number[];
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-border bg-background/45 p-2">
        <p className="text-xs font-semibold">{t("archive.before")}</p>
        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-muted-foreground">
          {localizedText(before, locale, beforeParameters, trailblazer)}
        </p>
      </div>
      <div className="rounded-md border border-primary/25 bg-primary/5 p-2">
        <p className="text-xs font-semibold">{t("archive.after")}</p>
        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-muted-foreground">
          {localizedText(after, locale, afterParameters, trailblazer)}
        </p>
      </div>
    </div>
  );
}

function EnhancementChanges({
  character,
  variant,
}: {
  character: CharacterDefinitionV1_1;
  variant: CharacterEnhancementVariant;
}) {
  const { t } = useI18n();
  function baseId(enhancedId: string): string {
    const withoutEnhancedPrefix = enhancedId.slice(1);
    return withoutEnhancedPrefix.startsWith(character.id)
      ? withoutEnhancedPrefix
      : enhancedId;
  }
  return (
    <div className="space-y-2">
      <details className="rounded-md border border-border p-2">
        <summary className="cursor-pointer text-xs font-medium">
          {t("archive.skillChanges", { value: variant.skill_changes.length })}
        </summary>
        <div className="mt-2 space-y-3">
          {variant.skill_changes.map((change) => {
            const before = character.skills.find(
              (skill) => skill.id === baseId(change.skill_id)
            )?.levels[0];
            const after = variant.skills.find(
              (skill) => skill.id === change.skill_id
            )?.levels[0];
            return (
              <div
                key={`${change.skill_id}:${change.trace_id}`}
                className="space-y-2 rounded-md bg-secondary/35 p-2"
              >
                <code className="text-xs">
                  {change.skill_id} · {change.trace_id}
                </code>
                <ChangePair
                  before={change.simple_description_before}
                  after={change.simple_description_after}
                  beforeParameters={before?.simple_parameters}
                  afterParameters={after?.simple_parameters}
                />
                <details className="rounded-md border border-border p-2">
                  <summary className="cursor-pointer text-xs font-medium">
                    {t("archive.fullDescription")}
                  </summary>
                  <div className="mt-2">
                    <ChangePair
                      before={change.description_before}
                      after={change.description_after}
                      beforeParameters={before?.parameters}
                      afterParameters={after?.parameters}
                    />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </details>

      <details className="rounded-md border border-border p-2">
        <summary className="cursor-pointer text-xs font-medium">
          {t("archive.traceChanges", { value: variant.trace_changes.length })}
        </summary>
        <div className="mt-2 space-y-3">
          {variant.trace_changes.map((change) => {
            const before = character.traces.find(
              (trace) => trace.id === baseId(change.trace_id)
            )?.levels[0]?.parameters;
            const after = variant.traces.find(
              (trace) => trace.id === change.trace_id
            )?.levels[0]?.parameters;
            return (
              <div
                key={change.trace_id}
                className="space-y-2 rounded-md bg-secondary/35 p-2"
              >
                <code className="text-xs">{change.trace_id}</code>
                <ChangePair
                  before={change.description_before}
                  after={change.description_after}
                  beforeParameters={before}
                  afterParameters={after}
                />
              </div>
            );
          })}
        </div>
      </details>

      <details className="rounded-md border border-border p-2">
        <summary className="cursor-pointer text-xs font-medium">
          {t("archive.eidolonChanges", { value: variant.rank_changes.length })}
        </summary>
        <div className="mt-2 space-y-3">
          {variant.rank_changes.map((change) => {
            const before = character.ranks.find(
              (rank) => rank.id === baseId(change.rank_id)
            )?.parameters;
            const after = variant.ranks.find(
              (rank) => rank.id === change.rank_id
            )?.parameters;
            return (
              <div
                key={change.rank_id}
                className="space-y-2 rounded-md bg-secondary/35 p-2"
              >
                <code className="text-xs">{change.rank_id}</code>
                <ChangePair
                  before={change.description_before}
                  after={change.description_after}
                  beforeParameters={before}
                  afterParameters={after}
                />
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function EnhancementVariant({
  character,
  variant,
  itemById,
  propertyTables,
}: {
  character: CharacterDefinitionV1_1;
  variant: CharacterEnhancementVariant;
  itemById: ProgressionItemIndex;
  propertyTables: PropertyCatalogV1_1;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  return (
    <details
      data-testid={`enhancement-variant-${variant.enhanced_id}`}
      className="rounded-lg border border-primary/30 bg-primary/5 p-3"
    >
      <summary className="cursor-pointer font-medium">
        {t("archive.seasonMetadata", {
          season: variant.season_id,
          activity: variant.activity_id,
          enhanced: variant.enhanced_id,
        })}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{t("archive.energy", { value: variant.max_energy })}</Badge>
          <Badge variant="outline">
            {t("archive.variantCounts", {
              skills: variant.skills.length,
              ranks: variant.ranks.length,
              traces: variant.traces.length,
            })}
          </Badge>
        </div>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.enhancementSummaries", {
              value: variant.summaries.length,
            })}
          </summary>
          <div className="mt-2 space-y-2">
            {variant.summaries.map((summary) => (
              <p
                key={summary.en.provenance.source_key}
                className="whitespace-pre-line text-xs leading-5 text-muted-foreground"
              >
                {localizedText(summary, locale, [], trailblazer)}
              </p>
            ))}
          </div>
        </details>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.enhancedSkills", { value: variant.skills.length })}
          </summary>
          <div className="mt-2">
            <SkillCollection skills={variant.skills} itemById={itemById} />
          </div>
        </details>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.enhancedEidolons", { value: variant.ranks.length })}
          </summary>
          <div className="mt-2">
            <RankCollection ranks={variant.ranks} itemById={itemById} />
          </div>
        </details>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t("archive.enhancedTraces", { value: variant.traces.length })}
          </summary>
          <div className="mt-2">
            <TraceCollection
              traces={variant.traces}
              itemById={itemById}
              propertyTables={propertyTables}
            />
          </div>
        </details>
        <EnhancementChanges character={character} variant={variant} />
      </div>
    </details>
  );
}

export function CharacterExtendedDetails({
  character,
  progressionItems,
  propertyTables,
}: {
  character: CharacterDefinitionV1_1;
  progressionItems: readonly ProgressionItem[];
  propertyTables: PropertyCatalogV1_1;
}) {
  const { locale, t } = useI18n();
  const itemById = createProgressionItemIndex(progressionItems);
  return (
    <>
      <details
        data-testid="character-base-skills"
        className="rounded-lg border border-border bg-background/45 p-3"
      >
        <summary className="cursor-pointer font-semibold">
          {t("archive.baseSkills", {
            skills: character.skills.length,
          })}
        </summary>
        <div className="mt-3">
          <SkillCollection skills={character.skills} itemById={itemById} />
        </div>
      </details>

      <details
        data-testid="character-eidolons"
        className="rounded-lg border border-border bg-background/45 p-3"
      >
        <summary className="cursor-pointer font-semibold">
          {t("archive.eidolons", { value: character.ranks.length })}
        </summary>
        <div className="mt-3">
          <RankCollection ranks={character.ranks} itemById={itemById} />
        </div>
      </details>

      <details
        data-testid="character-traces"
        className="rounded-lg border border-border bg-background/45 p-3"
      >
        <summary className="cursor-pointer font-semibold">
          {t("archive.traceTree", {
            nodes: character.traces.length,
          })}
        </summary>
        <div className="mt-3">
          <TraceCollection
            traces={character.traces}
            itemById={itemById}
            propertyTables={propertyTables}
          />
        </div>
      </details>

      {character.servants.length > 0 && (
        <details
          data-testid="character-servants"
          className="rounded-lg border border-border bg-background/45 p-3"
        >
          <summary className="cursor-pointer font-semibold">
            {t("archive.servants", {
              servants: character.servants.length,
            })}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {t("archive.servantBoundary")}
            </p>
            {character.servants.map((servant) => (
              <details
                key={servant.id}
                data-servant-id={servant.id}
                className="rounded-lg border border-primary/25 bg-primary/5 p-3"
              >
                <summary className="cursor-pointer font-medium">
                  {localizedText(
                    servant.name,
                    locale,
                    [],
                    t("terms.trailblazer")
                  )}{" "}
                  · {servant.id}
                </summary>
                <div className="mt-3">
                  <SkillCollection
                    skills={servant.skills}
                    itemById={itemById}
                  />
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      {character.enhancements.length > 0 && (
        <details
          data-testid="character-enhancements"
          className="rounded-lg border border-border bg-background/45 p-3"
        >
          <summary className="cursor-pointer font-semibold">
            {t("archive.seasonalEnhancements", {
              value: character.enhancements.length,
            })}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {t("archive.seasonalBoundary")}
            </p>
            {character.enhancements.map((variant) => (
              <EnhancementVariant
                key={variant.enhanced_id}
                character={character}
                variant={variant}
                itemById={itemById}
                propertyTables={propertyTables}
              />
            ))}
          </div>
        </details>
      )}

      <ExperienceItemSection items={progressionItems} kind="character" />
    </>
  );
}
