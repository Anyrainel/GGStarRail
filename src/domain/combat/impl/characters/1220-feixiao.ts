import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";
import type { DamageTag } from "../../model/tags";

/** Feixiao — The Hunt, Wind. */
export default defineCharacter("1220", (k) => {
  // "Flying Aureus" replaces Energy: the Ultimate is paid from this counter,
  // so Energy from enemy hits, ERR, or ally effects never fills it.
  const AUREUS = "flying-aureus";
  const ATTACKS = "aureus-attacks";
  const TALENT_READY = "thunderhunt-ready";
  const TALENT_USED = "thunderhunt-used";
  const E2_TRIGGERS = "e2-triggers";
  const attacksPerPoint = k.param("04", 2);
  const ultimateCost = k.param("04", 3);
  const aureusCap = k.param("04", 4);

  k.startingEnergy(0);

  const setAureus = (ctx: BattleApi, value: number) =>
    ctx.setCounter(ctx.self, AUREUS, Math.min(aureusCap, Math.max(0, value)));
  const countAttack = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, ATTACKS, 1);
    const attacks = ctx.self.counter(ATTACKS);
    if (attacks + 1e-9 < attacksPerPoint) return;
    ctx.setCounter(ctx.self, ATTACKS, attacks - attacksPerPoint);
    setAureus(ctx, ctx.self.counter(AUREUS) + 1);
  };

  const thunderhunt = k.status({
    id: "thunderhunt-dmg",
    origin: "talent",
    duration: { turns: k.param("04", 6) },
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 5) }],
  });
  const boltcatch = k.status({
    id: "boltcatch-atk",
    origin: "a6",
    duration: { turns: k.traceParam(3, 2) },
    modifiers: [{ stat: "atkPct", value: k.traceParam(3, 1) }],
  });
  const stormward = k.status({
    id: "stormward-spd",
    origin: "e4",
    duration: { turns: k.rankParam(4, 3) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(4, 2) }],
  });
  // Removed after a hit leaves the target Weakness Broken and at the end of
  // the Ultimate.
  const terrasplitEfficiency = k.status({
    id: "terrasplit-break-efficiency",
    origin: "ultimate",
    modifiers: [{ stat: "breakEfficiency", value: k.param("03", 2) }],
  });
  // "Increases the Ultimate DMG by 10% of the original DMG" per stack.
  const skywardQuell = k.status({
    id: "skyward-quell",
    origin: "e1",
    maxStacks: k.rankParam(1, 2),
    modifiers: [
      {
        stat: "dmgMultiplier",
        value: k.rankParam(1, 1),
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  if (k.a(2)) {
    k.stat("a4", {
      stat: "critDmg",
      value: k.traceParam(2, 1),
      filter: { tags: ["followUp"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 1),
      filter: { tags: ["ultimate"] },
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 0,
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    energy: 0,
    before: (ctx) => {
      if (k.a(3)) ctx.applyStatus(ctx.self, boltcatch);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    // The extra instance does not use up the Talent's once-per-turn trigger.
    after: (ctx) =>
      ctx.queueAction(ctx.self, "followUp", {
        target: isEnemy(ctx.target) ? ctx.target : undefined,
      }),
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    tags: k.e(6) ? ["followUp", "ultimate"] : ["followUp"],
    energy: 0,
    before: (ctx) => {
      ctx.applyStatus(ctx.self, thunderhunt);
      if (k.e(4)) ctx.applyStatus(ctx.self, stormward);
    },
    hits: [
      {
        shape: "single",
        main: k.param("04", 1) + (k.e(6) ? k.rankParam(6, 2) : 0),
        toughness: { main: 5 * (1 + (k.e(4) ? k.rankParam(4, 1) : 0)) },
      },
    ],
  });

  // Each strike is Boltsunder Blitz on a Broken target and Waraxe Skyward
  // otherwise, so every strike gets its +#2 bonus ("up to 700%"). The target
  // can break during the Ultimate, so the strikes are dealt one by one: a
  // Blitz lands in two hits of 10%/90%, a Skyward in one. The 30 displayed
  // Toughness is the six strikes' 6 × 5 (122008/122009 facts); the finishing
  // hit's own entry (122014) shows none.
  const ultimateTags: DamageTag[] = k.a(2)
    ? ["ultimate", "followUp"]
    : ["ultimate"];
  const strikeMultiplier = k.param("09", 1) + k.param("09", 2);
  const strikePart = (share: number): HitDef => ({
    shape: "single",
    main: strikeMultiplier * share,
    toughness: { main: 5 * share },
    toughnessWithoutWeakness: 1,
  });
  const blitzParts = [strikePart(0.1), strikePart(0.9)];
  const skywardParts = [strikePart(1)];
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    tags: ultimateTags,
    energy: 0,
    resource: { counter: AUREUS, amount: ultimateCost },
    before: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      if (!target.broken) ctx.applyStatus(ctx.self, terrasplitEfficiency);
      for (let strike = 0; strike < k.param("03", 3); strike += 1) {
        const parts = target.broken ? blitzParts : skywardParts;
        for (const part of parts) {
          ctx.deal(part, { targets: [target], tags: ultimateTags });
        }
        if (k.e(1)) ctx.applyStatus(ctx.self, skywardQuell);
      }
    },
    hits: [{ shape: "single", main: k.param("03", 1) }],
    after: (ctx) => {
      ctx.removeStatus(ctx.self, terrasplitEfficiency);
      ctx.removeStatus(ctx.self, skywardQuell);
    },
  });

  // "When the target is not Weakness Broken": dropped once a hit breaks it.
  k.on(
    "hit",
    "ultimate",
    { subject: "self", abilityKinds: ["ultimate"] },
    (ctx, event) => {
      if (isEnemy(event.target) && event.target.broken) {
        ctx.removeStatus(ctx.self, terrasplitEfficiency);
      }
    }
  );

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setCounter(ctx.self, TALENT_READY, 1);
    setAureus(ctx, k.a(1) ? k.traceParam(1, 1) : 0);
  });

  // A2 reads whether the Talent fired since the previous turn start before
  // the Talent resets. Only the teammate-triggered Talent counts; the Skill's
  // extra instance is launched via the Skill.
  if (k.a(1)) {
    k.on("turnStart", "a2", { subject: "self" }, (ctx) => {
      if (ctx.self.counter(TALENT_USED) <= 0) countAttack(ctx);
    });
  }
  k.on("turnStart", "talent", { subject: "self" }, (ctx) => {
    ctx.setCounter(ctx.self, TALENT_USED, 0);
    ctx.setCounter(ctx.self, TALENT_READY, 1);
  });

  // Once per Feixiao turn cycle: the trigger resets at her turn start rather
  // than at every unit's turn, so `limitPerTurn` does not fit.
  k.on(
    "actionEnd",
    "talent",
    { subject: "otherAlly", attack: true },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      if (ctx.self.counter(TALENT_READY) <= 0) return;
      ctx.setCounter(ctx.self, TALENT_READY, 0);
      ctx.setCounter(ctx.self, TALENT_USED, 1);
      ctx.queueAction(ctx.self, "followUp", { target: event.target });
    }
  );

  if (k.e(2)) {
    k.on("turnStart", "e2", { subject: "any" }, (ctx) =>
      ctx.setCounter(ctx.self, E2_TRIGGERS, 0)
    );
  }
  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (event.unit === ctx.self && event.abilityKind === "ultimate") return;
      // E2 ("即可"): a Follow-Up ATK is enough for a point on its own,
      // instead of counting as one of the two attacks.
      if (
        k.e(2) &&
        event.tags?.includes("followUp") &&
        ctx.self.counter(E2_TRIGGERS) < k.rankParam(2, 1)
      ) {
        ctx.setCounter(
          ctx.self,
          E2_TRIGGERS,
          ctx.self.counter(E2_TRIGGERS) + 1
        );
        setAureus(ctx, ctx.self.counter(AUREUS) + ctx.weight);
        return;
      }
      countAttack(ctx);
    }
  );
});
