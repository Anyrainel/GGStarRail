import type { AbilityDamage } from "@/domain/combat/evaluate/report";
import type { OptionDef } from "@/domain/combat/kit/builder";
import type { AbilityKind, EffectOrigin } from "@/domain/combat/kit/model";
import type { SCENARIO_PRESETS } from "@/domain/combat/team/input";
import type { Locale } from "@/i18n/locales";
import type { MessageKey } from "@/i18n/messages.en";
import { localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import type { CharacterDefinition } from "@/providers/reference/types";
import type { ValueOrigin } from "./resolve";

type Translate = (
  key: MessageKey,
  variables?: Record<string, string | number>
) => string;

export const ORIGIN_LABEL_KEYS = {
  basic: "combat.origin.basic",
  skill: "combat.origin.skill",
  ultimate: "combat.origin.ultimate",
  talent: "combat.origin.talent",
  technique: "combat.origin.technique",
  memospriteSkill: "combat.origin.memospriteSkill",
  memospriteTalent: "combat.origin.memospriteTalent",
  elationSkill: "combat.origin.elationSkill",
  a2: "combat.origin.a2",
  a4: "combat.origin.a4",
  a6: "combat.origin.a6",
  e1: "combat.origin.e1",
  e2: "combat.origin.e2",
  e4: "combat.origin.e4",
  e6: "combat.origin.e6",
  traceStats: "combat.origin.traceStats",
  lightCone: "combat.origin.lightCone",
  relic2pc: "combat.origin.relic2pc",
  relic4pc: "combat.origin.relic4pc",
  ornament: "combat.origin.ornament",
  scenario: "combat.origin.scenario",
} as const satisfies Record<EffectOrigin, MessageKey>;

export const VALUE_ORIGIN_LABEL_KEYS = {
  override: "combat.valueOrigin.override",
  account: "combat.valueOrigin.account",
  workspace: "combat.valueOrigin.workspace",
  recommended: "combat.valueOrigin.recommended",
  default: "combat.valueOrigin.default",
} as const satisfies Record<ValueOrigin, MessageKey>;

export type ScenarioPresetId = keyof typeof SCENARIO_PRESETS;

export const SCENARIO_LABEL_KEYS = {
  bossWithAdds: "combat.scenario.bossWithAdds",
  singleBoss: "combat.scenario.singleBoss",
  fiveTargets: "combat.scenario.fiveTargets",
} as const satisfies Record<ScenarioPresetId, MessageKey>;

const DAMAGE_KIND_LABEL_KEYS = {
  dot: "combat.damageKind.dot",
  break: "combat.damageKind.break",
  superBreak: "combat.damageKind.superBreak",
  elation: "combat.damageKind.elation",
} as const satisfies Partial<Record<AbilityDamage["kind"], MessageKey>>;

/** Catalog skill suffix for each ability origin with its own skill entry. */
const SKILL_SUFFIX: Partial<Record<EffectOrigin, string>> = {
  basic: "01",
  skill: "02",
  ultimate: "03",
  talent: "04",
  technique: "07",
  elationSkill: "20",
};

const BONUS_ABILITY_SUFFIX: Partial<Record<EffectOrigin, string>> = {
  a2: "101",
  a4: "102",
  a6: "103",
};

const EIDOLON_RANK: Partial<Record<EffectOrigin, number>> = {
  e1: 1,
  e2: 2,
  e4: 4,
  e6: 6,
};

/** The in-game name of the ability, Trace, or Eidolon behind an origin. */
export function originCatalogName(
  origin: EffectOrigin,
  character: CharacterDefinition | undefined,
  locale: Locale
): string | null {
  if (!character) return null;
  const skillSuffix = SKILL_SUFFIX[origin];
  if (skillSuffix) {
    const skill = character.skills.find(
      (entry) => entry.id === `${character.id}${skillSuffix}`
    );
    return skill ? formatGameText(localizedName(skill.name, locale, "")) : null;
  }
  const traceSuffix = BONUS_ABILITY_SUFFIX[origin];
  if (traceSuffix) {
    const trace = character.traces.find(
      (entry) => entry.id === `${character.id}${traceSuffix}`
    );
    return trace?.name
      ? formatGameText(localizedName(trace.name, locale, ""))
      : null;
  }
  const rank = EIDOLON_RANK[origin];
  if (rank !== undefined) {
    const entry = character.ranks.find((candidate) => candidate.rank === rank);
    return entry ? formatGameText(localizedName(entry.name, locale, "")) : null;
  }
  return null;
}

/** The condition part of an option label; `null` for plain toggles. */
export function optionConditionLabel(
  option: OptionDef,
  t: Translate
): string | null {
  const percent = Math.round((option.threshold ?? 0.5) * 100);
  switch (option.condition) {
    case "active":
      return null;
    case "stacks":
      return t("combat.condition.stacks");
    case "perCycle":
      return t("combat.condition.perCycle");
    case "enemyHpBelow":
      return t("combat.condition.enemyHpBelow", { percent });
    case "enemyHpAbove":
      return t("combat.condition.enemyHpAbove", { percent });
    case "selfHpBelow":
      return t("combat.condition.selfHpBelow", { percent });
    case "selfHpAbove":
      return t("combat.condition.selfHpAbove", { percent });
    case "enemyDefeated":
      return t("combat.condition.enemyDefeated");
  }
}

/** Breakdown label: the ability that dealt the damage and its damage type. */
export function abilityDamageLabel(entry: AbilityDamage, t: Translate): string {
  if (entry.kind === "break" || entry.kind === "superBreak")
    return t(DAMAGE_KIND_LABEL_KEYS[entry.kind]);
  const ability =
    entry.abilityKind === "followUp"
      ? t("combat.ability.followUp")
      : t(ORIGIN_LABEL_KEYS[entry.origin]);
  const kind =
    entry.kind === "dot" || entry.kind === "elation"
      ? DAMAGE_KIND_LABEL_KEYS[entry.kind]
      : null;
  return kind && t(kind) !== ability ? `${ability} · ${t(kind)}` : ability;
}

/** Timeline label for an action by its ability kind. */
export function actionLabel(kind: AbilityKind, t: Translate): string {
  switch (kind) {
    case "followUp":
      return t("combat.ability.followUp");
    case "other":
      return t("combat.ability.other");
    default:
      return t(ORIGIN_LABEL_KEYS[kind]);
  }
}

export function formatDamage(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactDamage(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale,
  fractionDigits = 1
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** "+3.2%" style change relative to a reference value. */
export function formatChange(
  value: number,
  reference: number,
  locale: Locale
): string {
  if (reference <= 0) return "—";
  const change = value / reference - 1;
  const formatted = formatPercent(Math.abs(change), locale);
  return change >= 0 ? `+${formatted}` : `−${formatted}`;
}
