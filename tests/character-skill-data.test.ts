import { describe, expect, it } from "vitest";
import { setBetaEnabled } from "@/data/betaState";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import { skillComparisonPlan } from "@/pages/archive/CharacterSkillCard";
import {
  getLocalizedValue,
  loadCharacters,
  loadLightCones,
} from "@/providers/reference/catalog";

describe("Published character and Light Cone text", () => {
  it("resolves comparison references and numeric templates across every visible skill, locale and combat level", async () => {
    setBetaEnabled(true);
    const [characters, lightCones] = await Promise.all([
      loadCharacters(),
      loadLightCones(),
    ]);
    const failures: string[] = [];
    let checked = 0;
    let remapped = 0;
    for (const character of characters.values) {
      const skills = [
        ...character.skills,
        ...character.servants.flatMap((servant) => servant.skills),
        ...character.enhancements.flatMap((variant) => variant.skills),
        ...character.currency_war.flatMap((role) =>
          role.star_levels.flatMap((star) => [
            ...star.front_skills,
            ...star.back_skills,
            ...star.servant_skills,
          ])
        ),
      ];
      for (const skill of skills.filter(
        (entry) => !("hide_in_ui" in entry) || !entry.hide_in_ui
      ))
        for (const locale of ["en", "zh-CN"] as const) {
          const full = getLocalizedValue(skill.description, locale);
          const brief =
            getLocalizedValue(skill.simple_description, locale) ?? "";
          for (const useSimple of [false, true]) {
            const plan = skillComparisonPlan(
              full,
              brief,
              skill.levels,
              useSimple
            );
            for (const row of plan.rows) {
              const values = skill.levels.map((level) => ({
                parameters:
                  row.source === "simple"
                    ? level.simple_parameters
                    : level.parameters,
              }));
              try {
                const rendered = formatGameTextVariants(
                  row.token,
                  values,
                  "Trailblazer"
                );
                if (/#\d+(?:\[|%)/.test(rendered))
                  failures.push(
                    `${character.id}/${skill.id}/${locale}: ${rendered}`
                  );
              } catch {
                failures.push(
                  `${character.id}/${skill.id}/${locale}: missing ${row.source} ${row.token}`
                );
              }
              checked++;
            }
            if (useSimple)
              for (const [token, number] of plan.descriptionNumbers) {
                const canonical = plan.rows.find(
                  (row) => row.source === "full" && row.token === token
                );
                if (canonical && canonical.number !== number) remapped++;
              }
          }
          if ("condition_description" in skill && skill.condition_description) {
            try {
              formatGameTextVariants(
                getLocalizedValue(skill.condition_description, locale),
                [{ parameters: skill.condition_parameters }],
                "Trailblazer"
              );
            } catch {
              failures.push(
                `${character.id}/${skill.id}/${locale}: missing condition parameter`
              );
            }
          }
        }
    }
    for (const cone of lightCones.values)
      for (const locale of ["en", "zh-CN"] as const)
        for (const level of cone.effect.superimpositions) {
          try {
            formatGameTextVariants(
              getLocalizedValue(
                level.description ?? cone.effect.description,
                locale
              ),
              [level],
              "Trailblazer"
            );
          } catch {
            failures.push(
              `${cone.id}/${level.level}/${locale}: missing Superimposition parameter`
            );
          }
          checked++;
        }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(1000);
    // The published data contains real examples where raw placeholder indices
    // mean different values between brief and full descriptions.
    expect(remapped).toBeGreaterThan(0);
  }, 60_000);
});
