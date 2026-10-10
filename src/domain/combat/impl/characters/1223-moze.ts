import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { AbilityKind } from "../../kit/model";

/** Moze — The Hunt, Lightning. */
export default defineCharacter("1223", (k) => {
  const CHARGE = "charge";
  const TALLY = "charge-tally";
  const PREY_ATTACKED = "prey-attacked";
  const chargePerFollowUp = k.param("04", 2);
  const attackKinds: readonly AbilityKind[] = [
    "basic",
    "skill",
    "ultimate",
    "followUp",
    "memospriteSkill",
    "elationSkill",
    "talent",
  ];

  // "Prey" is a mark ("成为【猎物】"), not an inflicted debuff.
  const prey = k.status({ id: "prey", origin: "skill" });
  const vengewise = k.status({
    id: "vengewise",
    origin: "a6",
    modifiers: [
      {
        stat: "vulnerability",
        value: k.traceParam(3, 1),
        filter: { tags: ["followUp"] },
      },
    ],
  });
  // Approximation: the CRIT DMG is held by allies while Prey exists, so it
  // also reaches their hits on other enemies.
  const wrathbearer = k.status({
    id: "wrathbearer",
    origin: "e2",
    modifiers: [{ stat: "critDmg", value: k.rankParam(2, 1) }],
  });
  const heathprowler = k.status({
    id: "heathprowler",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(4, 1) }],
  });

  const preyTarget = (ctx: BattleApi) =>
    ctx.enemies.find((enemy) => enemy.has(prey));

  const dispelPrey = (ctx: BattleApi) => {
    for (const enemy of ctx.enemies) {
      ctx.removeStatus(enemy, prey);
      ctx.removeStatus(enemy, vengewise);
    }
    for (const ally of ctx.allies) ctx.removeStatus(ally, wrathbearer);
    ctx.setCounter(ctx.self, CHARGE, 0);
    ctx.setCounter(ctx.self, TALLY, 0);
    if (!ctx.self.inActionOrder) {
      ctx.setInActionOrder(ctx.self, true);
      if (k.a(2)) ctx.advanceAction(ctx.self, k.traceParam(2, 1));
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      for (const enemy of ctx.enemies) {
        ctx.removeStatus(enemy, prey);
        ctx.removeStatus(enemy, vengewise);
      }
      ctx.applyStatus(ctx.target, prey);
      if (k.a(3)) ctx.applyStatus(ctx.target, vengewise);
      if (k.e(2)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, wrathbearer);
      }
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (!preyTarget(ctx)) return;
      ctx.setCounter(ctx.self, CHARGE, k.param("02", 2));
      ctx.setCounter(ctx.self, TALLY, 0);
      // Departed: Moze leaves the Action Order while Prey exists.
      ctx.setInActionOrder(ctx.self, false);
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: [
      {
        shape: "single",
        main: k.param("04", 3) + (k.e(6) ? k.rankParam(6, 1) : 0),
        toughness: { main: 10 },
      },
    ],
    // The Charge-launched Follow-Up ATK on the last Charge resolves against
    // Prey before Prey is dispelled.
    after: (ctx) => {
      if (ctx.self.counter(CHARGE) <= 1e-9 && preyTarget(ctx)) dispelPrey(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    tags: k.a(3) ? ["ultimate", "followUp"] : ["ultimate"],
    before: (ctx) => {
      if (k.e(4)) ctx.applyStatus(ctx.self, heathprowler);
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) =>
      ctx.queueAction(ctx.self, "followUp", {
        target: isEnemy(ctx.target) ? ctx.target : undefined,
      }),
  });

  // "After ally targets attack Prey": an attack action whose hits landed on
  // Prey (AoE included). Moze's own Skill marks Prey and grants the Charge,
  // so it does not consume one; his Ultimate does.
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, PREY_ATTACKED, 0)
  );
  k.on(
    "hit",
    "talent",
    { subject: "ally", abilityKinds: attackKinds },
    (ctx, event) => {
      if (isEnemy(event.target) && event.target.has(prey)) {
        ctx.setCounter(ctx.self, PREY_ATTACKED, 1);
      }
    }
  );
  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (ctx.self.counter(PREY_ATTACKED) <= 0) return;
      ctx.setCounter(ctx.self, PREY_ATTACKED, 0);
      if (
        event.unit === ctx.self &&
        (event.abilityId === "skill" || event.abilityId === "followUp")
      ) {
        return;
      }
      const target = preyTarget(ctx);
      if (!target || ctx.self.counter(CHARGE) <= 1e-9) return;
      ctx.deal(
        { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
        { targets: [target], origin: "talent" }
      );
      if (k.e(1)) ctx.gainEnergy(ctx.self, k.rankParam(1, 1));
      ctx.addCounter(ctx.self, CHARGE, -1);
      ctx.addCounter(ctx.self, TALLY, 1);
      const tally = ctx.self.counter(TALLY);
      if (tally + 1e-9 >= chargePerFollowUp) {
        ctx.setCounter(ctx.self, TALLY, tally - chargePerFollowUp);
        ctx.queueAction(ctx.self, "followUp", { target });
      } else if (ctx.self.counter(CHARGE) <= 1e-9) {
        dispelPrey(ctx);
      }
    }
  );

  if (k.a(1)) {
    k.on(
      "actionEnd",
      "a2",
      { subject: "self", abilityKinds: ["followUp"], limitPerTurn: 1 },
      (ctx) => ctx.gainSkillPoints(k.traceParam(1, 1))
    );
  }

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(2, 2))
    );
  }
  if (k.e(1)) {
    k.on("battleStart", "e1", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(1, 2))
    );
  }
});
