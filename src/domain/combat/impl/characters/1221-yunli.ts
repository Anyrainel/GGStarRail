import { type AbilityDef, type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Yunli — Destruction, Physical. */
export default defineCharacter("1221", (k) => {
  // Parry ends with the next ally or enemy turn (listeners below). Its Taunt
  // and the A4 DMG reduction are not modeled; see the tracker.
  const parry = k.status({ id: "parry", origin: "ultimate" });
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
    },
  });

  const counterStart = (ctx: BattleApi) => {
    if (k.a(3)) ctx.applyStatus(ctx.self, trueSunder);
  };
  const counterEnd = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, nextCounterCritDmg);
  };

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
    after: counterEnd,
  });

  // Slash/Cull Energy and the Toughness of Cull's extra instances are not in
  // the facts (tracked as needs-data): none is assumed.
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
      counterEnd(ctx);
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
      },
    ])
  );

  const talentEnergy = k.param("04", 3);
  const HANDLED = "parry-handled-attack";

  // Under Taunt every enemy attack targets Yunli, so any enemy attack while
  // Parry is active is countered with Cull. E6 (any enemy ability triggers
  // Cull) adds nothing here because every enemy action is an attack.
  k.on("enemyAttack", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const attacker = event.unit;
    const parried = ctx.self.has(parry) && isEnemy(attacker);
    ctx.setCounter(ctx.self, HANDLED, parried ? 1 : 0);
    if (!parried) return;
    ctx.removeStatus(ctx.self, parry);
    ctx.gainEnergy(ctx.self, talentEnergy);
    ctx.queueAction(ctx.self, "intuitCull", { target: attacker });
  });

  k.on("hitByEnemy", "talent", { subject: "self" }, (ctx, event) => {
    if (ctx.self.counter(HANDLED) >= 1) return;
    const attacker = event.target;
    if (!isEnemy(attacker)) return;
    ctx.gainEnergy(ctx.self, talentEnergy);
    ctx.queueAction(ctx.self, "counter", { target: attacker });
  });

  // No Counter during Parry: Slash on a random enemy (the engine's main
  // target), replaced by Cull after a Slash with A2.
  const SLASHED = "a2-slash-used";
  const parryExpires = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, parry);
    const cull = k.a(1) && ctx.self.counter(SLASHED) >= 1;
    if (k.a(1)) ctx.setCounter(ctx.self, SLASHED, cull ? 0 : 1);
    ctx.queueAction(ctx.self, cull ? "intuitCull" : "intuitSlash");
  };
  // An ally turn cannot attack Yunli, so Parry is known to expire unused as
  // soon as it starts; queuing then runs Slash at the end of that turn.
  k.on("turnStart", "ultimate", { subject: "ally" }, (ctx, event) => {
    if (event.unit.kind === "summon" || !ctx.self.has(parry)) return;
    parryExpires(ctx);
  });
  // An enemy turn without an attack (e.g. Frozen). The queued Slash runs
  // with the next queue flush, one turn late.
  k.on("turnEnd", "ultimate", { subject: "enemy" }, (ctx) => {
    if (ctx.self.has(parry)) parryExpires(ctx);
  });
});
