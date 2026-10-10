import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { AbilityKind, ModifierDef } from "../../kit/model";

/**
 * Make Farewells More Beautiful — Remembrance. Max HP is applied from
 * catalog properties.
 */
export default defineLightCone("23040", (k) => {
  const defIgnore: ModifierDef = { stat: "defIgnore", value: k.s(2) };
  const deathFlower = k.status({
    id: "make-farewells-more-beautiful-death-flower",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [defIgnore],
  });
  // The memosprite ignores DEF while the wearer holds Death Flower.
  const deathFlowerMemosprite = k.status({
    id: "make-farewells-more-beautiful-death-flower-memosprite",
    origin: "lightCone",
    modifiers: [defIgnore],
  });
  const memosprites = (ctx: BattleApi) =>
    ctx.allies.filter(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    );
  const sync = (ctx: BattleApi) => {
    const active = ctx.self.has(deathFlower);
    for (const unit of memosprites(ctx)) {
      if (active && !unit.has(deathFlowerMemosprite)) {
        ctx.applyStatus(unit, deathFlowerMemosprite);
      } else if (!active && unit.has(deathFlowerMemosprite)) {
        ctx.removeStatus(unit, deathFlowerMemosprite);
      }
    }
  };

  // HP is not simulated. HP lost during their own turns is assumed at the
  // start of the abilities that consume it (HP costs precede the DMG), as
  // in Longevous Disciple: Castorice's Skills and Netherwing's Memosprite
  // Skills (Breath and Wings consume HP; Claw is counted too), Evernight's
  // Basic ATK (with A2) and Skill. Other wearers default off and, when
  // enabled, lose HP with every Basic ATK and Skill.
  const ownHpCosts: Readonly<
    Record<string, { self: AbilityKind[]; memosprite: AbilityKind[] }>
  > = {
    "1407": { self: ["skill"], memosprite: ["memospriteSkill"] },
    "1413": { self: ["basic", "skill"], memosprite: [] },
  };
  const knownCosts = ownHpCosts[canonicalCharacterId(k.wearer.characterId)];
  const losesHp = k.toggle(
    "own-turn-hp-lost",
    "lightCone",
    "active",
    knownCosts !== undefined
  );
  if (losesHp) {
    const costs = knownCosts ?? { self: ["basic", "skill"], memosprite: [] };
    const gainDeathFlower = (ctx: BattleApi) => {
      ctx.applyStatus(ctx.self, deathFlower);
      sync(ctx);
    };
    k.on(
      "actionStart",
      "lightCone",
      { abilityKinds: costs.self },
      gainDeathFlower
    );
    if (costs.memosprite.length > 0) {
      k.on(
        "actionStart",
        "lightCone",
        { subject: "memosprite", abilityKinds: costs.memosprite },
        gainDeathFlower
      );
    }
  }
  k.on("actionStart", "lightCone", { subject: "any" }, sync);

  // "When the memosprite disappears" is checked at turn and action
  // boundaries (there is no dismissal event). The advance triggers once
  // until the wearer's next Ultimate.
  const PRESENT = "lc23040:present";
  const SPENT = "lc23040:spent";
  const checkDeparture = (ctx: BattleApi) => {
    const present = memosprites(ctx).length > 0 ? 1 : 0;
    const was = ctx.self.counter(PRESENT);
    ctx.setCounter(ctx.self, PRESENT, present);
    if (was === 0 || present === 1 || ctx.self.counter(SPENT) > 0) return;
    ctx.setCounter(ctx.self, SPENT, 1);
    ctx.advanceAction(ctx.self, k.s(4));
  };
  for (const event of [
    "turnStart",
    "turnEnd",
    "actionStart",
    "actionEnd",
  ] as const) {
    k.on(event, "lightCone", { subject: "any" }, checkDeparture);
  }
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.setCounter(ctx.self, SPENT, 0)
  );
});
