import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { AbilityKind, HitDef } from "../../kit/model";

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

  // Prey and A6's Follow-Up vulnerability are Debuffs in the game's status
  // config.
  const prey = k.status({ id: "prey", origin: "skill", debuff: true });
  const vengewise = k.status({
    id: "vengewise",
    origin: "a6",
    debuff: true,
    modifiers: [
      {
        stat: "vulnerability",
        value: k.traceParam(3, 1),
        filter: { tags: ["followUp"] },
      },
    ],
  });
  if (k.e(2)) {
    k.teamStat("e2", {
      stat: "critDmg",
      value: k.rankParam(2, 1),
      filter: { targetStatuses: [prey.id] },
    });
  }
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
    ctx.setCounter(ctx.self, CHARGE, 0);
    ctx.setCounter(ctx.self, TALLY, 0);
    if (ctx.self.departed) {
      ctx.setDeparted(ctx.self, false);
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

  // Hit splits from the game's ability config: Skill 15/15/70%, Talent
  // Follow-Up ATK 5 × 8% + 60%, Toughness in the same ratio.
  const split = (
    multiplier: number,
    toughness: number,
    shares: readonly number[]
  ): HitDef[] =>
    shares.map((share) => ({
      shape: "single",
      main: multiplier * share,
      toughness: { main: toughness * share },
    }));

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
    },
    hits: split(k.param("02", 1), 20, [0.15, 0.15, 0.7]),
    // Departed: Moze leaves the field while Prey exists. In the game the
    // Charge is set after the Skill's own Prey trigger, which spends none.
    after: (ctx) => {
      if (!preyTarget(ctx)) return;
      ctx.setCounter(ctx.self, CHARGE, k.param("02", 2));
      ctx.setCounter(ctx.self, TALLY, 0);
      ctx.setDeparted(ctx.self, true);
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: split(
      k.param("04", 3) + (k.e(6) ? k.rankParam(6, 1) : 0),
      10,
      [0.08, 0.08, 0.08, 0.08, 0.08, 0.6]
    ),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    tags: k.a(3) ? ["ultimate", "followUp"] : ["ultimate"],
    castOutsideActionOrder: true,
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
  // Prey (AoE included) triggers the Additional DMG (and E1's Energy). It
  // spends a Charge except for Moze's own Follow-Up ATKs ("Talent's
  // Follow-Up ATK does not consume Charge") and the Skill that marks Prey,
  // which runs before the Charge is set.
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
      const attacked = ctx.self.counter(PREY_ATTACKED) > 0;
      ctx.setCounter(ctx.self, PREY_ATTACKED, 0);
      const target = preyTarget(ctx);
      if (!attacked || !target) return;
      ctx.deal(
        { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
        { targets: [target], origin: "talent" }
      );
      if (k.e(1)) ctx.gainEnergy(ctx.self, k.rankParam(1, 1));
      const own = event.unit === ctx.self;
      if (own && event.abilityId === "followUp") {
        // The Follow-Up ATK on the last Charge resolves against Prey (A6
        // included) before Prey is dispelled.
        if (ctx.self.counter(CHARGE) <= 1e-9) dispelPrey(ctx);
        return;
      }
      if (own && event.abilityId === "skill") return;
      if (ctx.self.counter(CHARGE) <= 1e-9) return;
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
