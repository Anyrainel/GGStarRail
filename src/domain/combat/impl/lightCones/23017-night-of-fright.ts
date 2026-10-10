import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { AbilityKind } from "../../kit/model";

/** Who one of the wearer's healing abilities restores. */
type HealScope = "target" | "targetAndAdjacent" | "all";

/**
 * Healing is not simulated, so the wearer "provides healing" with the
 * abilities that heal in its kit. Heals tied to the healer's own states
 * (Huohuo's Divine Provision, Luocha's Zone, Gallagher's Besotted, healing
 * over time, Bailu's Invigoration) are not seen (tracker
 * night-of-fright-heal-triggers).
 */
const HEALING: Readonly<
  Record<string, Partial<Record<AbilityKind, HealScope>>>
> = {
  "1105": { skill: "target", ultimate: "all" }, // Natasha
  "1110": { skill: "target", ultimate: "all" }, // Lynx
  "1203": { skill: "target" }, // Luocha
  // Bailu's Skill heals its target, then random allies: about one heal each.
  "1211": { skill: "all", ultimate: "all" },
  "1217": { skill: "targetAndAdjacent" }, // Huohuo
  "1222": { skill: "all", ultimate: "all", followUp: "all" }, // Lingsha, Fuyuan
  "1301": { skill: "target" }, // Gallagher
};
const DEFAULT_HEALING: Partial<Record<AbilityKind, HealScope>> = {
  skill: "target",
  ultimate: "all",
};

/** Ally targets: Characters and memosprites, not countdowns or summons. */
const isAllyTarget = (unit: UnitView) =>
  unit.kind === "character" || unit.kind === "memosprite";

/**
 * Night of Fright — Abundance. Energy Regeneration Rate is applied from
 * catalog properties.
 */
export default defineLightCone("23017", (k) => {
  const deepBreaths = k.status({
    id: "deep-deep-breaths",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    maxStacks: k.s(4),
    modifiers: [{ stat: "atkPct", value: k.s(3) }],
  });
  const healed = (ctx: BattleApi, ally: UnitView, share = 1) =>
    ctx.applyStatus(ally, deepBreaths, { stacks: ctx.weight * share });

  // "When any ally uses their Ultimate": the heal goes to the ally with the
  // lowest HP percentage. HP is not simulated, so it is spread evenly.
  k.on(
    "actionStart",
    "lightCone",
    { subject: "ally", abilityKinds: ["ultimate"] },
    (ctx) => {
      const targets = ctx.allies.filter(isAllyTarget);
      for (const ally of targets) healed(ctx, ally, 1 / targets.length);
    }
  );

  const healing = HEALING[k.wearer.characterId] ?? DEFAULT_HEALING;
  const kinds = Object.keys(healing) as AbilityKind[];
  k.on("actionEnd", "lightCone", { abilityKinds: kinds }, (ctx, event) => {
    const scope = event.abilityKind && healing[event.abilityKind];
    const allies = ctx.allies.filter(isAllyTarget);
    if (scope === "all") {
      for (const ally of allies) healed(ctx, ally);
      return;
    }
    const target =
      event.target && !isEnemy(event.target) && isAllyTarget(event.target)
        ? event.target
        : ctx.self;
    healed(ctx, target);
    if (scope !== "targetAndAdjacent") return;
    for (const ally of allies) {
      if (
        ally.kind === "character" &&
        Math.abs(ally.slot - target.slot) === 1
      ) {
        healed(ctx, ally);
      }
    }
  });
});
