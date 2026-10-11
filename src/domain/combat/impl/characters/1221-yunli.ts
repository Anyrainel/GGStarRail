import {
  type AbilityDef,
  type ActionContext,
  type BattleApi,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const HANDLED = "parry-handled-attack";
const SLASHED = "a2-slash-used";
/** Random-target branches of one Intuit Counter still to resolve. */
const BRANCHES = "intuit-branches";
const PRIOR_SUNDER = "prior-true-sunder";

/** Yunli — Destruction, Physical. */
export default defineCharacter("1221", (k) => {
  // Parry ends with the next ally or enemy turn (listeners below). The A4
  // DMG reduction is not modeled.
  const parry = k.status({ id: "parry", origin: "ultimate" });
  // Taunt on every enemy while Parry lasts: their attacks target Yunli.
  const taunt = k.status({
    id: "parry-taunt",
    origin: "ultimate",
    debuff: true,
    taunt: true,
  });
  // "Increases the CRIT DMG dealt by Yunli's next Counter."
  const nextCounterCritDmg = k.status({
    id: "next-counter-crit-dmg",
    origin: "ultimate",
    modifiers: [{ stat: "critDmg", value: k.param("03", 2) }],
  });
  const trueSunder = k.status({
    id: "true-sunder",
    origin: "a6",
    duration: { turns: 1 },
    modifiers: [{ stat: "atkPct", value: k.traceParam(3, 1) }],
  });
  const e4EffectRes = k.status({
    id: "e4-effect-res",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "effectRes", value: k.rankParam(4, 1) }],
  });

  // Intuit: Slash/Cull are Counters dealing Ultimate DMG; the Talent Counter
  // deals Follow-Up DMG. Together they are all of Yunli's Counter DMG.
  if (k.e(1)) {
    k.stat("e1", {
      stat: "dmgBoost",
      value: k.rankParam(1, 1),
      filter: { tags: ["ultimate"] },
    });
  }
  if (k.e(2)) {
    k.stat("e2", {
      stat: "defIgnore",
      value: k.rankParam(2, 1),
      filter: { tags: ["followUp", "ultimate"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "critRate",
      value: k.rankParam(6, 1),
      filter: { tags: ["ultimate"] },
    });
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 2),
      filter: { tags: ["ultimate"], combatTypes: ["Physical"] },
    });
  }

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
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    before: (ctx) => {
      const maxHp = ctx.self.currentStat("hp");
      if (maxHp <= 0) return;
      const amount =
        (k.param("02", 3) * ctx.self.currentStat("atk") + k.param("02", 4)) *
        (1 + ctx.self.currentStat("outgoingHealing"));
      ctx.heal(ctx.self, amount / maxHp);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    energyCost: k.param("03", 8),
    usable: (view) => !view.self.has(parry),
    after: (ctx) => {
      ctx.applyStatus(ctx.self, parry);
      ctx.applyStatus(ctx.self, nextCounterCritDmg);
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, taunt);
    },
  });

  const endParry = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, parry);
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, taunt);
  };

  // A6 at full strength for the Counter's own (already weighted) hits.
  const counterStart = (ctx: ActionContext) => {
    if (!k.a(3)) return;
    ctx.setCounter(ctx.self, PRIOR_SUNDER, ctx.self.stacks(trueSunder));
    ctx.applyStatus(ctx.self, trueSunder);
  };

  // Talent Counter, with Yunli's aggro share of the attack as its weight:
  // afterwards A6 is held with the chance that some Counter happened.
  k.ability({
    id: "counter",
    kind: "followUp",
    energy: 10,
    hits: [
      {
        shape: "blast",
        main: k.param("04", 1),
        adjacent: k.param("04", 2),
        toughness: { main: 10, adjacent: 10 },
      },
    ],
    before: counterStart,
    after: (ctx) => {
      ctx.removeStatus(ctx.self, nextCounterCritDmg);
      if (k.a(3)) {
        const prior = ctx.self.counter(PRIOR_SUNDER);
        const chance = 1 - (1 - prior) * (1 - Math.min(1, ctx.weight));
        ctx.setStatusStacks(ctx.self, trueSunder, chance);
      }
    },
  });

  // Slash and Cull regenerate no Energy (ability config: no ModifySP); Cull's
  // extra instances reduce 5 Toughness each (20 x 0.25).
  const intuit: HitDef = {
    shape: "blast",
    main: k.param("03", 1),
    adjacent: k.param("03", 6),
    toughness: { main: 20, adjacent: 10 },
  };
  const intuitAbility = (id: string, hits: readonly HitDef[]): AbilityDef => ({
    id,
    kind: "followUp",
    tags: ["ultimate"],
    hits,
    before: counterStart,
    after: (ctx) => {
      // Each branch resolves its weight's share (addCounter is weighted).
      ctx.addCounter(ctx.self, BRANCHES, -1);
      if (ctx.self.counter(BRANCHES) <= 1e-9) {
        ctx.setCounter(ctx.self, BRANCHES, 0);
        ctx.removeStatus(ctx.self, nextCounterCritDmg);
      }
      if (k.e(4)) ctx.applyStatus(ctx.self, e4EffectRes);
    },
  });
  k.ability(intuitAbility("intuitSlash", [intuit]));
  k.ability(
    intuitAbility("intuitCull", [
      intuit,
      {
        shape: "bounce",
        each: k.param("03", 7),
        bounces: k.param("03", 4) + (k.e(1) ? k.rankParam(1, 2) : 0),
        toughness: { each: 5 },
      },
    ])
  );

  const talentEnergy = k.param("04", 3);

  // Under Taunt every enemy attack targets Yunli and is countered with Cull.
  // E6 (any enemy ability triggers Cull) adds nothing here because every
  // enemy action is an attack.
  k.on("enemyAttack", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const attacker = event.unit;
    const parried = ctx.self.has(parry) && isEnemy(attacker);
    ctx.setCounter(ctx.self, HANDLED, parried ? 1 : 0);
    if (!parried) return;
    endParry(ctx);
    ctx.gainEnergy(ctx.self, talentEnergy);
    ctx.setCounter(ctx.self, BRANCHES, ctx.weight);
    ctx.queueAction(ctx.self, "intuitCull", { target: attacker });
  });

  k.on("hitByEnemy", "talent", { subject: "self" }, (ctx, event) => {
    if (ctx.self.counter(HANDLED) >= 1) return;
    const attacker = event.target;
    if (!isEnemy(attacker)) return;
    ctx.gainEnergy(ctx.self, talentEnergy);
    ctx.queueAction(ctx.self, "counter", { target: attacker });
  });

  // No Counter during Parry: Slash on a random enemy (each enemy as a
  // weighted branch), replaced by Cull after a Slash with A2.
  const parryExpires = (ctx: BattleApi) => {
    endParry(ctx);
    const cull = k.a(1) && ctx.self.counter(SLASHED) >= 1;
    if (k.a(1)) ctx.setCounter(ctx.self, SLASHED, cull ? 0 : 1);
    const enemies = ctx.enemies;
    ctx.setCounter(ctx.self, BRANCHES, 1);
    for (const enemy of enemies) {
      ctx.queueAction(ctx.self, cull ? "intuitCull" : "intuitSlash", {
        target: enemy,
        weight: 1 / enemies.length,
      });
    }
  };
  // An ally turn cannot attack Yunli, so Parry is known to expire unused as
  // soon as it starts; queuing then runs Slash at the end of that turn.
  k.on(
    "turnStart",
    "ultimate",
    {
      subject: "ally",
      when: (event, self) => event.unit.kind !== "summon" && self.has(parry),
    },
    (ctx) => parryExpires(ctx)
  );
  // An enemy turn without an attack (e.g. Frozen). The queued Slash runs
  // with the next queue flush, one turn late.
  k.on(
    "turnEnd",
    "ultimate",
    { subject: "enemy", when: (_event, self) => self.has(parry) },
    (ctx) => parryExpires(ctx)
  );

  // Ultimate right before an enemy turn, so that enemy's attack meets Parry
  // and is answered with Cull.
  k.policy({ ultimate: (view) => isEnemy(view.upcoming) });
});
