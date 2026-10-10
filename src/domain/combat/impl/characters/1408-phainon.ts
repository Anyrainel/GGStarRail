import type { BattleApi, PolicyView, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, ModifierDef } from "../../kit/model";

/** Phainon — Destruction, Physical. */
export default defineCharacter("1408", (k) => {
  // Coreflame is Phainon's Energy (max 12 in data) but has its own sources,
  // so it lives in a counter and the Ultimate costs no engine Energy.
  const ultimateCost = k.param("04", 4);
  const coreflameCap = k.e(6)
    ? Number.POSITIVE_INFINITY
    : ultimateCost + k.param("04", 3);
  k.startingEnergy(0);

  const pyricCorpus = k.status({
    id: "pyric-corpus-crit-dmg",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    modifiers: [{ stat: "critDmg", value: k.param("04", 1) }],
  });

  const khaslanaModifiers: ModifierDef[] = [
    { stat: "atkPct", value: k.param("05", 4) },
    { stat: "hpPct", value: k.param("05", 5) },
  ];
  if (k.e(2)) {
    khaslanaModifiers.push({
      stat: "resPen",
      value: k.rankParam(2, 2),
      filter: { combatTypes: ["Physical"] },
    });
  }
  const khaslana = k.status({
    id: "khaslana",
    origin: "ultimate",
    modifiers: khaslanaModifiers,
  });

  // During the transformation the overflow is held for its end and no
  // Coreflame is gained ("When the transformation ends, gains Coreflame based
  // on the number of overflow points").
  const gainCoreflame = (ctx: BattleApi, amount: number) => {
    if (ctx.self.has(khaslana)) return;
    const next = ctx.self.counter("coreflame") + amount;
    ctx.setCounter(ctx.self, "coreflame", Math.min(coreflameCap, next));
  };

  const e1CritDmg = k.status({
    id: "e1-crit-dmg",
    origin: "e1",
    duration: { turns: k.rankParam(1, 3) },
    modifiers: [{ stat: "critDmg", value: k.rankParam(1, 2) }],
  });

  const shineWithValor = k.status({
    id: "a6-shine-with-valor",
    origin: "a6",
    maxStacks: k.a(3) ? k.traceParam(3, 2) : 1,
    modifiers: [{ stat: "atkPct", value: k.a(3) ? k.traceParam(3, 1) : 0 }],
  });

  // "Each stack increases the DMG multiplier of said Counter by #5 of its
  // original multiplier value": present only while the Counter resolves.
  const soulscorch = k.status({
    id: "soulscorch",
    origin: "skill",
    maxStacks: 99,
    modifiers: [{ stat: "dmgMultiplier", value: k.param("09", 5) }],
  });

  const e6TrueDmg = k.status({
    id: "e6-true-dmg",
    origin: "e6",
    modifiers: [{ stat: "trueDmg", value: k.rankParam(6, 1) }],
  });

  const allySpeed = k.status({
    id: "khaslana-end-spd",
    origin: "talent",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: k.param("05", 6) }],
  });

  // A4 heal/Shield trigger: healing and Shields are not simulated, so it is
  // assumed always active when the team has an Abundance or Preservation ally.
  if (k.a(2)) {
    const sustained = k.toggle(
      "a4-healed-or-shielded",
      "a4",
      "active",
      k.countPath("Priest") + k.countPath("Knight") > 0
    );
    if (sustained)
      k.stat("a4", { stat: "dmgBoost", value: k.traceParam(2, 1) });
  }

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setEnergy(ctx.self, 0);
    if (k.a(1)) gainCoreflame(ctx, k.traceParam(1, 2));
    if (k.e(6)) gainCoreflame(ctx, k.rankParam(6, 2));
    if (k.a(3)) ctx.applyStatus(ctx.self, shineWithValor);
  });

  // Talent: targeted by an enemy attack (aggro share) or by a teammate's
  // ability. Ally-targeted abilities carry no target in the engine, so a
  // teammate's non-attacking Skill/Ultimate/memosprite Skill counts.
  k.on("hitByEnemy", "talent", {}, (ctx) => gainCoreflame(ctx, ctx.weight));
  k.on(
    "actionEnd",
    "talent",
    {
      subject: "otherAlly",
      abilityKinds: ["skill", "ultimate", "memospriteSkill"],
      attack: false,
    },
    (ctx) => {
      gainCoreflame(ctx, ctx.weight);
      ctx.applyStatus(ctx.self, pyricCorpus);
    }
  );

  // A4 Energy part: Phainon's engine Energy is kept at 0, so Energy found
  // after a teammate's action came from that teammate's ability.
  k.on("actionEnd", "a4", { subject: "otherAlly" }, (ctx) => {
    if (ctx.self.energy > 1e-9 && k.a(2)) {
      gainCoreflame(ctx, k.traceParam(2, 3) * ctx.weight);
    }
    ctx.setEnergy(ctx.self, 0);
  });
  const clearEnergy = (ctx: BattleApi) => ctx.setEnergy(ctx.self, 0);
  k.on("actionEnd", "a4", {}, clearEnergy);
  k.on("turnEnd", "a4", { subject: "enemy" }, clearEnergy);

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
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => gainCoreflame(ctx, k.param("02", 3)),
  });

  // ---------------------------------------------------------------------
  // Khaslana. The Territory runs on its own timeline: the battle's action
  // value does not advance and teammates are Departed, so the transformation
  // is a chain of queued actions at the moment of the Ultimate (tracker
  // phainon-territory-timeline). Buffs do not tick during it.

  const totalTurns = k.param("03", 4);
  const fullScourge = k.param("11", 4);
  const perScourgeInstances = k.param("11", 3);

  /** "Distributed evenly across all enemies": one instance split by target. */
  const evenlySplit = (multiplier: number, toughness: number): HitDef[] => [
    { shape: "bounce", each: multiplier, bounces: 1 },
    // Toughness of the split hit reaches every enemy in full.
    { shape: "aoe", each: 0, toughness: { each: toughness } },
  ];

  const soulscorchStacks = (enemies: number) =>
    1 + enemies + (k.e(4) ? k.rankParam(4, 1) : 0);

  /** Sum of multipliers over all targets, for the Khaslana action choice. */
  const value = {
    stardeath: (scourge: number) =>
      scourge * perScourgeInstances * k.param("11", 2) +
      (scourge >= fullScourge ? k.param("11", 1) : 0),
    soulscorch: (enemies: number) =>
      (k.param("09", 1) * enemies + k.param("09", 3) * k.param("09", 4)) *
      (1 + k.param("09", 5) * soulscorchStacks(enemies)),
    bloodthorn: (enemies: number) =>
      k.param("08", 1) + k.param("08", 2) * Math.min(2, enemies - 1),
  };

  /**
   * Stardeath at 4 Scourge; otherwise the better of Soulscorch and the
   * Enhanced Basic ATK, counting the Scourge each gains while a later action
   * can still spend it. The last action spends leftover Scourge when that
   * deals more.
   */
  const chooseKhaslanaAction = (ctx: BattleApi, turn: number): string => {
    const scourge = Math.floor(ctx.self.counter("scourge") + 1e-9);
    if (scourge >= fullScourge) return `stardeath${fullScourge}`;
    const enemies = ctx.enemies.length;
    const isLast = turn >= totalTurns - 1;
    const worth = isLast ? 0 : value.stardeath(fullScourge) / fullScourge;
    const options: [string, number][] = [
      ["soulscorch", value.soulscorch(enemies) + worth * enemies],
      ["bloodthorn", value.bloodthorn(enemies) + worth * k.param("08", 3)],
    ];
    if (isLast && scourge > 0) {
      options.push([`stardeath${scourge}`, value.stardeath(scourge)]);
    }
    options.sort((left, right) => right[1] - left[1]);
    return options[0]?.[0] ?? "bloodthorn";
  };

  /** Queue the next Khaslana extra turn (E2 extra turns do not count). */
  const nextKhaslanaTurn = (ctx: BattleApi, counts = true) => {
    const turn = ctx.self.counter("khaslana-turn") + (counts ? 1 : 0);
    ctx.setCounter(ctx.self, "khaslana-turn", turn);
    ctx.queueAction(
      ctx.self,
      turn >= totalTurns ? "finalHit" : chooseKhaslanaAction(ctx, turn)
    );
  };

  const isDeparted = (unit: UnitView) => unit.counter("1408:departed") > 0;

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    energy: 0,
    energyCost: 0,
    usable: (view: PolicyView) =>
      view.self.counter("khaslana-turn") === 0 &&
      view.self.counter("coreflame") >= ultimateCost - 1e-9,
    before: (ctx) => {
      // The overflow stays in the counter and returns when the form ends.
      ctx.setCounter(
        ctx.self,
        "coreflame",
        ctx.self.counter("coreflame") - ultimateCost
      );
      ctx.setCounter(ctx.self, "scourge", k.param("05", 1));
      ctx.applyStatus(ctx.self, khaslana);
      if (k.e(1)) ctx.applyStatus(ctx.self, e1CritDmg);
      for (const ally of ctx.allies) {
        if (ally === ctx.self || !ally.inActionOrder) continue;
        ctx.setCounter(ally, "1408:departed", 1);
        ctx.setInActionOrder(ally, false);
      }
      // Weaknesses cannot be removed when the Territory ends (tracker
      // phainon-territory-weakness).
      for (const enemy of ctx.enemies) ctx.implantWeakness(enemy, "Physical");
    },
    after: (ctx) => nextKhaslanaTurn(ctx),
  });

  k.ability({
    id: "bloodthorn",
    kind: "basic",
    skillPoints: 0,
    energy: 0,
    hits: [
      {
        shape: "blast",
        main: k.param("08", 1),
        adjacent: k.param("08", 2),
        toughness: { main: 30, adjacent: 20 },
      },
    ],
    after: (ctx) => {
      ctx.setCounter(
        ctx.self,
        "scourge",
        ctx.self.counter("scourge") + k.param("08", 3)
      );
      nextKhaslanaTurn(ctx);
    },
  });

  // Enemies' forced actions are not simulated: each adds a Soulscorch stack.
  // Facts list Toughness 10 (first slot) and 5 (AoE slot); as for Stardeath,
  // the first slot is read per random instance (tracker phainon-toughness-split).
  k.ability({
    id: "soulscorch",
    kind: "skill",
    skillPoints: 0,
    energy: 0,
    before: (ctx) => {
      const enemies = ctx.enemies.length;
      ctx.setCounter(
        ctx.self,
        "scourge",
        ctx.self.counter("scourge") + enemies
      );
      ctx.applyStatus(ctx.self, soulscorch, {
        setStacks: soulscorchStacks(enemies),
      });
    },
    hits: [
      { shape: "aoe", each: k.param("09", 1), toughness: { each: 5 } },
      {
        shape: "bounce",
        each: k.param("09", 4),
        bounces: k.param("09", 3),
        toughness: { each: 10 },
      },
    ],
    after: (ctx) => {
      ctx.removeStatus(ctx.self, soulscorch);
      nextKhaslanaTurn(ctx);
    },
  });

  // One variant per Scourge consumed (1-4), since the instance count varies.
  for (let consumed = 1; consumed <= fullScourge; consumed += 1) {
    const full = consumed >= fullScourge;
    k.ability({
      id: `stardeath${consumed}`,
      kind: "skill",
      skillPoints: 0,
      energy: 0,
      before: (ctx) => {
        ctx.setCounter(
          ctx.self,
          "scourge",
          Math.max(0, ctx.self.counter("scourge") - consumed)
        );
        // E6 True DMG totals #1 of this attack's DMG; spreading it over the
        // hit targets instead of the highest-HP enemy keeps the total.
        if (k.e(6)) ctx.applyStatus(ctx.self, e6TrueDmg);
      },
      hits: [
        {
          shape: "bounce",
          each: k.param("11", 2),
          bounces: consumed * perScourgeInstances,
          // Facts: 3.33 per instance, 20 (AoE slot) for the split part.
          toughness: { each: 10 / 3 },
        },
        ...(full ? evenlySplit(k.param("11", 1), 20) : []),
      ],
      after: (ctx) => {
        ctx.removeStatus(ctx.self, e6TrueDmg);
        const extraTurn = k.e(2) && consumed >= k.rankParam(2, 1);
        nextKhaslanaTurn(ctx, !extraTurn);
      },
    });
  }

  k.ability({
    id: "finalHit",
    kind: "other",
    origin: "ultimate",
    tags: ["ultimate"],
    skillPoints: 0,
    energy: 0,
    hits: evenlySplit(k.param("03", 1), 20),
    after: (ctx) => {
      ctx.removeStatus(ctx.self, khaslana);
      ctx.setCounter(ctx.self, "scourge", 0);
      ctx.setCounter(ctx.self, "khaslana-turn", 0);
      for (const ally of ctx.allies) {
        if (isDeparted(ally)) {
          ctx.setCounter(ally, "1408:departed", 0);
          ctx.setInActionOrder(ally, true);
        }
        ctx.applyStatus(ally, allySpeed);
      }
      if (k.a(1)) gainCoreflame(ctx, k.traceParam(1, 1));
      if (k.a(3)) ctx.applyStatus(ctx.self, shineWithValor);
    },
  });
});
