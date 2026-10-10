import { defineRelicSet } from "../../kit/equipment";
import type { AbilityKind } from "../../kit/model";

/** Longevous Disciple. Max HP is applied from catalog properties. */
export default defineRelicSet("113", {
  fourPiece: (k) => {
    const critRate = k.status({
      id: "longevous-crit-rate",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      maxStacks: k.param(3),
      modifiers: [{ stat: "critRate", value: k.param(1) }],
    });
    // Enemy attacks reach the wearer with its aggro share.
    k.on("hitByEnemy", "relic4pc", {}, (ctx) =>
      ctx.applyStatus(ctx.self, critRate, { stacks: ctx.weight })
    );

    // HP is not simulated, so the wearer's own HP consumption is assumed at
    // the start of the ability kinds that consume it (HP costs precede the
    // DMG). Known consumers default on, as in The Unreachable Side: Blade
    // (Skill, Forest of Swords, Ultimate), Arlan and Mydei (Skills). Other
    // wearers default off and, when enabled, consume HP with every Basic
    // ATK, Skill, and Ultimate. HP consumed by allies is not modelled.
    const ownHpCosts: Readonly<Record<string, readonly AbilityKind[]>> = {
      "1205": ["basic", "skill", "ultimate"],
      "1008": ["skill"],
      "1404": ["skill"],
    };
    const knownCosts = ownHpCosts[k.wearer.characterId];
    const consumesHp = k.toggle(
      "own-hp-consumed",
      "relic4pc",
      "active",
      knownCosts !== undefined
    );
    if (consumesHp) {
      k.on(
        "actionStart",
        "relic4pc",
        { abilityKinds: knownCosts ?? ["basic", "skill", "ultimate"] },
        (ctx) => ctx.applyStatus(ctx.self, critRate, { stacks: ctx.weight })
      );
    }
  },
});
