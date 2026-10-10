import { BREAK_EFFECT_STATUS } from "../../battle/breakEffects";
import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Yanqing — The Hunt, Ice. */
export default defineCharacter("1209", (k) => {
  // E6 needs a kill; when the user assumes one per buff window, Soulsteel
  // Sync and the Ultimate buffs last 1 extra turn.
  const e6Extension =
    k.e(6) && k.toggle("e6-defeat", "e6", "enemyDefeated", false) ? 1 : 0;

  const syncModifiers: ModifierDef[] = [
    { stat: "critRate", value: k.param("04", 1) },
    { stat: "critDmg", value: k.param("04", 2) },
  ];
  if (k.a(2)) {
    syncModifiers.push({ stat: "effectRes", value: k.traceParam(2, 1) });
  }
  if (k.e(2)) {
    syncModifiers.push({ stat: "energyRegen", value: k.rankParam(2, 1) });
  }
  // Stacks hold the probability that Soulsteel Sync is still up: each enemy
  // attack removes it with Yanqing's aggro share of that attack.
  const soulsteelSync = k.status({
    id: "soulsteel-sync",
    origin: "talent",
    duration: { turns: 1 + e6Extension },
    modifiers: syncModifiers,
  });

  const ultCritRate = k.status({
    id: "raining-bliss-crit-rate",
    origin: "ultimate",
    duration: { turns: 1 + e6Extension },
    modifiers: [{ stat: "critRate", value: k.param("03", 1) }],
  });
  const ultCritDmg = k.status({
    id: "raining-bliss-crit-dmg",
    origin: "ultimate",
    duration: { turns: 1 + e6Extension },
    modifiers: [{ stat: "critDmg", value: k.param("03", 2) }],
  });

  // Frozen: Ice Additional DMG at the start of the enemy's turn. Stacks are
  // the expected presence when the Follow-Up ATK itself is probabilistic.
  const frozen = k.status({
    id: "frozen",
    origin: "talent",
    debuff: true,
    duration: { turns: 1 },
    dot: {
      hit: {
        shape: "single",
        main: k.param("04", 5),
        kind: "direct",
        tags: ["additional"],
      },
    },
  });

  if (k.e(4)) {
    const healthy = k.toggle(
      "e4-hp",
      "e4",
      "selfHpAbove",
      true,
      k.rankParam(4, 1)
    );
    if (healthy) {
      k.stat("e4", {
        stat: "resPen",
        value: k.rankParam(4, 2),
        filter: { combatTypes: ["Ice"] },
      });
    }
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
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    // Text order: the DMG lands, then Soulsteel Sync activates.
    after: (ctx) => ctx.applyStatus(ctx.self, soulsteelSync, { setStacks: 1 }),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      ctx.applyStatus(ctx.self, ultCritRate);
      const sync = ctx.self.stacks(soulsteelSync);
      if (sync > 0) {
        ctx.applyStatus(ctx.self, ultCritDmg, { setStacks: sync });
      }
    },
    hits: [
      { shape: "single", main: k.param("03", 3), toughness: { main: 30 } },
    ],
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: [
      { shape: "single", main: k.param("04", 4), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      // applyStatus ignores the action's weight, so the presence is passed
      // as stacks (maxStacks 1).
      ctx.applyStatus(ctx.target, frozen, {
        baseChance: k.param("04", 6),
        stacks: ctx.weight,
      });
    },
  });

  // The Follow-Up ATK is part of Soulsteel Sync; it does not chain itself.
  k.on(
    "actionEnd",
    "talent",
    { abilityKinds: ["basic", "skill", "ultimate"], attack: true },
    (ctx, event) => {
      const sync = ctx.self.stacks(soulsteelSync);
      if (sync <= 0) return;
      ctx.queueAction(ctx.self, "followUp", {
        target: isEnemy(event.target) ? event.target : undefined,
        weight: k.param("04", 3) * sync,
      });
    }
  );

  // "When Yanqing receives DMG, Soulsteel Sync disappears." consumeStacks is
  // not weighted by the API, so the aggro share is applied here.
  k.on("hitByEnemy", "talent", {}, (ctx) => {
    const sync = ctx.self.stacks(soulsteelSync);
    if (sync > 0) ctx.consumeStacks(ctx.self, soulsteelSync, sync * ctx.weight);
  });

  if (k.a(1)) {
    k.on("actionEnd", "a2", { attack: true }, (ctx, event) => {
      const target = event.target;
      if (!isEnemy(target) || !target.weaknesses.has("Ice")) return;
      ctx.deal(
        { shape: "single", main: k.traceParam(1, 1), onlyTags: ["additional"] },
        { targets: [target], origin: "a2" }
      );
    });
  }

  if (k.a(3)) {
    const gentleBlade = k.status({
      id: "gentle-blade",
      origin: "a6",
      duration: { turns: k.traceParam(3, 2) },
      modifiers: [{ stat: "spdPct", value: k.traceParam(3, 1) }],
    });
    // Approximation: CRIT is evaluated in expectation, so every attack counts
    // as landing a CRIT Hit (Soulsteel Sync and the Ultimate push CRIT Rate high).
    k.on("actionEnd", "a6", { attack: true }, (ctx) =>
      ctx.applyStatus(ctx.self, gentleBlade)
    );
  }

  if (k.e(1)) {
    // Frozen is checked when the attack starts so the Freeze this attack
    // inflicts does not count; the DMG lands after the attack.
    k.on("actionStart", "e1", { attack: true }, (ctx, event) => {
      const target = event.target;
      const presence = !isEnemy(target)
        ? 0
        : target.has(BREAK_EFFECT_STATUS.frozen)
          ? 1
          : target.stacks(frozen);
      ctx.setCounter(ctx.self, "e1-frozen", presence);
    });
    k.on("actionEnd", "e1", { attack: true }, (ctx, event) => {
      const presence = ctx.self.counter("e1-frozen");
      ctx.setCounter(ctx.self, "e1-frozen", 0);
      if (presence <= 0 || !isEnemy(event.target)) return;
      ctx.deal(
        {
          shape: "single",
          // Expected presence of Yanqing's own Freeze (landing chance aside).
          main: k.rankParam(1, 1) * presence,
          onlyTags: ["additional"],
        },
        { targets: [event.target], origin: "e1" }
      );
    });
  }

  k.policy({
    // Skill every turn to keep Soulsteel Sync up; Ultimate right after a
    // Skill refreshed it, unless no Skill Point is available to refresh it.
    ultimate: (view) =>
      view.self.stacks(soulsteelSync) >= 1 - 1e-9 || view.skillPoints < 1,
  });
});
