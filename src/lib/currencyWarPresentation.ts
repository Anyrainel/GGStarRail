import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import type {
  CharacterSkill,
  CurrencyWarSkill,
  CurrencyWarStarLevel,
  LocalizedText,
} from "@/providers/reference/types";

export function currencyWarSkillLevelCaps(
  skill: CurrencyWarSkill,
  characterSkills: readonly CharacterSkill[]
) {
  const matches = characterSkills.filter(
    (entry) =>
      entry.id === skill.id ||
      (["en", "zh-CN"] as const).every(
        (locale) =>
          formatGameText(entry.name[locale].value) ===
          formatGameText(skill.name[locale].value)
      )
  );
  const base = matches.length === 1 ? matches[0] : undefined;
  const max = Math.min(base?.max_level ?? skill.max_level, skill.max_level);
  return {
    max_level: max,
    normal_max_level: Math.min(base?.normal_max_level ?? max, max),
  };
}

/** Star-specific skill IDs differ; slot plus authored text defines a display group. */
export function currencyWarSkillGroups(
  stars: readonly CurrencyWarStarLevel[],
  collection: "front_skills" | "back_skills" | "servant_skills"
) {
  const groups = new Map<
    string,
    {
      key: string;
      skill: CurrencyWarSkill;
      variants: { star: number; skill: CurrencyWarSkill }[];
    }
  >();
  for (const star of stars) {
    star[collection].forEach((skill, slot) => {
      const key = JSON.stringify([
        slot,
        skill.name,
        skill.description,
        skill.simple_description,
        skill.condition_description,
        skill.tag,
        skill.type_description,
        skill.levels.map((level) => level.level),
      ]);
      const group = groups.get(key) ?? { key, skill, variants: [] };
      group.variants.push({ star: star.star, skill });
      groups.set(key, group);
    });
  }
  return [...groups.values()];
}

export function currencyWarTextGroups(
  stars: readonly CurrencyWarStarLevel[],
  field: "front_description" | "back_description"
) {
  const groups = new Map<string, { text: LocalizedText; stars: number[] }>();
  for (const star of stars) {
    const text = star[field];
    if (!text) continue;
    const key = JSON.stringify(text);
    const group = groups.get(key) ?? { text, stars: [] };
    group.stars.push(star.star);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function formatStarValues(
  values: readonly (number | null | undefined)[],
  kind: "flat" | "ratio" | "unknown" = "flat"
) {
  const formatted = values.map((value) =>
    value == null ? "—" : formatCatalogValue(value, kind)
  );
  if (formatted.every((value) => value === formatted[0]))
    return formatted[0] ?? "—";
  return kind === "ratio" && values.every((value) => value != null)
    ? `${formatted.map((value) => value.replace(/%$/, "")).join("/")}%`
    : formatted.join("/");
}
