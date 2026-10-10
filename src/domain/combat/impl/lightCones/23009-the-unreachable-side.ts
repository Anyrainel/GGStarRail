import { defineLightCone } from "../../kit/equipment";
import type { AbilityKind } from "../../kit/model";

/**
 * The Unreachable Side — Destruction. CRIT Rate and Max HP are applied from
 * catalog properties.
 */
export default defineLightCone("23009", (k) => {
  // HP is not simulated, so the wearer's own HP consumption is assumed at the
  // start of the ability kinds that consume it. Known consumers default on:
  // Blade (Skill, Forest of Swords, Ultimate), Arlan and Mydei (Skills; Mydei's
  // Godslayer Be God costs Charge instead). Other wearers default off and,
  // when enabled, consume HP with every Basic ATK, Skill, and Ultimate.
  const ownHpCosts: Readonly<Record<string, readonly AbilityKind[]>> = {
    "1205": ["basic", "skill", "ultimate"],
    "1008": ["skill"],
    "1404": ["skill"],
  };
  const knownCosts = ownHpCosts[k.wearer.characterId];
  const consumesHp = k.toggle(
    "own-hp-consumed",
    "lightCone",
    "active",
    knownCosts !== undefined
  );

  const unfulfilled = k.status({
    id: "unfulfilled-yearning",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });

  // Enemy attacks reach the wearer with its aggro share.
  k.on("hitByEnemy", "lightCone", {}, (ctx) =>
    ctx.applyStatus(ctx.self, unfulfilled, { stacks: ctx.weight })
  );
  if (consumesHp) {
    k.on(
      "actionStart",
      "lightCone",
      { abilityKinds: knownCosts ?? ["basic", "skill", "ultimate"] },
      (ctx) => ctx.applyStatus(ctx.self, unfulfilled)
    );
  }
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.removeStatus(ctx.self, unfulfilled)
  );
});
