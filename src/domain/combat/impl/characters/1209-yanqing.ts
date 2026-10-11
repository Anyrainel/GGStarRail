import { BREAK_EFFECT_STATUS } from "../../battle/breakEffects";
import { type BattleApi, type EventFilter, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, ModifierDef } from "../../kit/model";

/** Yanqing — The Hunt, Ice. */
export default defineCharacter("1209", (k) => {
  const SYNC_BEFORE = "sync-before-attack";
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
  // "Less likely to be attacked": the game's config lowers his AggroBase by
  // 60% while it is held (no text parameter).
  syncModifiers.push({ stat: "aggroPct", value: -0.6 });
  // Stacks hold the probability that Soulsteel Sync is still up: each HP
  // loss removes it with that loss's probability.
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
    const searingSting = k.status({
      id: "searing-sting",
      origin: "e4",
      modifiers: [
        {
          stat: "resPen",
          value: k.rankParam(4, 2),
          filter: { combatTypes: ["Ice"] },
        },
      ],
    });
    // Held while his (expected) HP is at #1 or higher.
    const syncSearingSting = (ctx: BattleApi) => {
      const healthy = ctx.self.hpRatio >= k.rankParam(4, 1) - 1e-9;
      if (healthy && !ctx.self.has(searingSting)) {
        ctx.applyStatus(ctx.self, searingSting);
      } else if (!healthy && ctx.self.has(searingSting)) {
        ctx.removeStatus(ctx.self, searingSting);
      }
    };
    k.on("battleStart", "e4", { subject: "any" }, syncSearingSting);
    k.on("hpChanged", "e4", {}, syncSearingSting);
  }

  // Hit splits from the game's ability config: Basic ATK 50/25/25%, Skill
  // 4 × 25%, Follow-Up ATK 30/70%; Toughness splits the same way.
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
    id: "basic",
    kind: "basic",
    hits: split(k.param("01", 1), 10, [0.5, 0.25, 0.25]),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: split(k.param("02", 1), 20, [0.25, 0.25, 0.25, 0.25]),
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
    hits: split(k.param("04", 4), 10, [0.3, 0.7]),
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
  // The game rolls it before the attack from the Soulsteel Sync held then,
  // so the Skill that first applies it does not trigger one.
  const ownAttacks: EventFilter = {
    abilityKinds: ["basic", "skill", "ultimate"],
    attack: true,
  };
  k.on("actionStart", "talent", ownAttacks, (ctx) =>
    ctx.setCounter(ctx.self, SYNC_BEFORE, ctx.self.stacks(soulsteelSync))
  );
  k.on("actionEnd", "talent", ownAttacks, (ctx, event) => {
    const sync = ctx.self.counter(SYNC_BEFORE);
    ctx.setCounter(ctx.self, SYNC_BEFORE, 0);
    if (sync <= 0) return;
    ctx.queueAction(ctx.self, "followUp", {
      target: isEnemy(event.target) ? event.target : undefined,
      weight: k.param("04", 3) * sync,
    });
  });

  // "When Yanqing receives DMG, Soulsteel Sync disappears": the game removes
  // it on any HP decrease, so a Shield that absorbs an enemy hit keeps it
  // (Shield HP is not modeled; a Shield is assumed to absorb the hit).
  // consumeStacks is not weighted by the API, so the loss's probability is
  // applied here.
  k.on(
    "hpChanged",
    "talent",
    {
      when: (event, self) =>
        (event.delta ?? 0) < 0 &&
        !(event.hpCause === "enemy" && self.hasFamily("shield")),
    },
    (ctx) => {
      const sync = ctx.self.stacks(soulsteelSync);
      if (sync > 0) {
        ctx.consumeStacks(ctx.self, soulsteelSync, sync * ctx.weight);
      }
    }
  );

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
