import { canonicalCharacterId } from "@/domain/characterIdentity";
import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Jade — Erudition, Quantum. */
export default defineCharacter("1314", (k) => {
  const CHARGE = "jade:charge";
  /** Remaining Ultimate-enhanced Follow-Up ATKs. */
  const VOW = "jade:vow";
  /** On an attacker: its current attack counts enemies hit for Jade. */
  const TRACKING = "jade:tracking";
  /** On an enemy: hit by the tracked attack. */
  const HIT = "jade:hit";
  const chargeThreshold = k.param("04", 3);

  const pawnedAsset = k.status({
    id: "pawned-asset",
    origin: "talent",
    maxStacks: k.param("04", 2),
    modifiers: [{ stat: "critDmg", value: k.param("04", 1) }],
  });
  // A6 rides on Pawned Asset; kept as its own status for attribution.
  const assetForfeiture = k.status({
    id: "asset-forfeiture",
    origin: "a6",
    maxStacks: k.param("04", 2),
    modifiers: [{ stat: "atkPct", value: k.traceParam(3, 1) }],
  });
  const e2CritRate = k.status({
    id: "e2-crit-rate",
    origin: "e2",
    modifiers: [{ stat: "critRate", value: k.rankParam(2, 2) }],
  });

  const gainPawnedAsset = (ctx: BattleApi, stacks: number) => {
    ctx.applyStatus(ctx.self, pawnedAsset, { stacks });
    if (k.a(3)) ctx.applyStatus(ctx.self, assetForfeiture, { stacks });
    if (k.e(2) && ctx.self.stacks(pawnedAsset) >= k.rankParam(2, 1)) {
      ctx.applyStatus(ctx.self, e2CritRate);
    }
  };

  // "At the start of Jade's every turn, the Debt Collector's duration
  // decreases by 1 turn."
  const collectorDuration = {
    turns: k.param("02", 4),
    countdown: "turnStart",
    clock: "applier",
  } as const;
  const debtCollector = k.status({
    id: "debt-collector",
    origin: "skill",
    duration: collectorDuration,
    modifiers: [{ stat: "spdFlat", value: k.param("02", 1) }],
  });
  // Jade as the Debt Collector gets no SPD; at E6 she holds it whenever a
  // Debt Collector exists, with Quantum RES PEN.
  const jadeCollector = k.status({
    id: "debt-collector-jade",
    origin: k.e(6) ? "e6" : "skill",
    duration: collectorDuration,
    modifiers: k.e(6)
      ? [
          {
            stat: "resPen",
            value: k.rankParam(6, 1),
            filter: { combatTypes: ["Quantum"] },
          },
        ]
      : [],
  });
  const isCollector = (unit: UnitView) =>
    unit.has(debtCollector) || unit.has(jadeCollector);

  // The Skill goes to the teammate who attacks most: damage-dealing Paths
  // first, then the highest SPD; Jade herself only when alone.
  const attackerPaths = new Set([
    "Warrior",
    "Rogue",
    "Mage",
    "Warlock",
    "Elation",
  ]);
  const pathOf = new Map(
    k.team.map((member) => [member.characterId, member.pathId])
  );
  const chooseCollector = (self: UnitView, allies: readonly UnitView[]) => {
    let best: UnitView = self;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const ally of allies) {
      if (ally === self || ally.kind !== "character") continue;
      const path = pathOf.get(canonicalCharacterId(ally.definitionId)) ?? "";
      const score = (attackerPaths.has(path) ? 1000 : 0) + ally.speed;
      if (score > bestScore) {
        best = ally;
        bestScore = score;
      }
    }
    return best;
  };

  const vowActive = k.status({
    id: "vow-of-the-deep",
    origin: "ultimate",
    modifiers: [
      {
        stat: "multiplierBoost",
        value: k.param("03", 1),
        filter: { tags: ["followUp"] },
      },
    ],
  });
  const e4DefIgnore = k.status({
    id: "e4-def-ignore",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "defIgnore", value: k.rankParam(4, 1) }],
  });

  if (k.e(1)) {
    k.stat("e1", {
      stat: "dmgBoost",
      value: k.rankParam(1, 1),
      filter: { tags: ["followUp"] },
    });
  }

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      gainPawnedAsset(ctx, k.traceParam(1, 2) * ctx.enemies.length)
    );
    k.on("turnStart", "a2", { subject: "ally" }, (ctx, event) => {
      if (isCollector(event.unit)) gainPawnedAsset(ctx, k.traceParam(1, 1));
    });
  }

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(2, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "blast",
        main: k.param("01", 1),
        adjacent: k.param("01", 2),
        toughness: { main: 10, adjacent: 5 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    usable: (view) => !view.allies.some(isCollector),
    before: (ctx) => {
      const target = chooseCollector(ctx.self, ctx.allies);
      if (target !== ctx.self) ctx.applyStatus(target, debtCollector);
      if (target === ctx.self || k.e(6)) {
        ctx.applyStatus(ctx.self, jadeCollector);
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (k.e(4)) ctx.applyStatus(ctx.self, e4DefIgnore);
    },
    hits: [{ shape: "aoe", each: k.param("03", 3), toughness: { each: 20 } }],
    // Recasting refreshes the enhancement to its full count.
    after: (ctx) => ctx.setCounter(ctx.self, VOW, k.param("03", 2)),
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    before: (ctx) => {
      gainPawnedAsset(ctx, k.param("04", 4));
      const vow = ctx.self.counter(VOW);
      if (vow > 1e-9) {
        ctx.applyStatus(ctx.self, vowActive);
        ctx.setCounter(ctx.self, VOW, Math.max(0, vow - 1));
      }
    },
    hits: [{ shape: "aoe", each: k.param("04", 5), toughness: { each: 10 } }],
    after: (ctx) => ctx.removeStatus(ctx.self, vowActive),
  });

  // Count the enemies hit by each attack of Jade or the Debt Collector.
  k.on(
    "actionStart",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (event.unit !== ctx.self && !isCollector(event.unit)) return;
      ctx.setCounter(event.unit, TRACKING, 1);
      for (const enemy of ctx.enemies) ctx.setCounter(enemy, HIT, 0);
    }
  );
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    if (event.unit.counter(TRACKING) !== 1 || !isEnemy(event.target)) return;
    ctx.setCounter(event.target, HIT, 1);
  });
  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      const attacker = event.unit;
      if (attacker.counter(TRACKING) !== 1) return;
      ctx.setCounter(attacker, TRACKING, 0);
      const targets = ctx.enemies.filter((enemy) => enemy.counter(HIT) === 1);
      if (targets.length === 0) return;
      const collector = isCollector(attacker);
      if (collector) {
        ctx.deal(
          { shape: "aoe", each: k.param("02", 3), onlyTags: ["additional"] },
          { targets, origin: "skill" }
        );
      }
      // "This Follow-Up ATK does not generate Charge."
      if (attacker === ctx.self && event.abilityId === "followUp") return;
      let charge = targets.length;
      if (k.e(1) && collector) {
        if (targets.length === 2) charge += k.rankParam(1, 2);
        else if (targets.length === 1) charge += k.rankParam(1, 3);
      }
      if (ctx.weight <= 0) return;
      ctx.addCounter(ctx.self, CHARGE, charge);
      // Charge is an expected amount; each full threshold launches one whole
      // Follow-Up ATK whatever the weight of the triggering attack.
      while (ctx.self.counter(CHARGE) >= chargeThreshold - 1e-9) {
        ctx.setCounter(
          ctx.self,
          CHARGE,
          ctx.self.counter(CHARGE) - chargeThreshold
        );
        ctx.queueAction(ctx.self, "followUp", { weight: 1 / ctx.weight });
      }
    }
  );

  // Skill only to (re)appoint a Debt Collector; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 && !view.allies.some(isCollector)
        ? "skill"
        : "basic",
  });
});
