import { type BattleApi, isEnemy, type PolicyView } from "../../kit/api";
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

  if (k.a(2)) {
    // A4: healing or a Shield from a teammate, once per turn.
    const bideInFlames = k.status({
      id: "a4-bide-in-flames",
      origin: "a4",
      duration: { turns: k.traceParam(2, 2) },
      modifiers: [{ stat: "dmgBoost", value: k.traceParam(2, 1) }],
    });
    const bide = (ctx: BattleApi) =>
      ctx.applyStatus(ctx.self, bideInFlames, { stacks: ctx.weight });
    k.on(
      "hpChanged",
      "a4",
      {
        limitPerTurn: 1,
        when: (event, self) =>
          event.hpCause === "heal" &&
          event.source !== undefined &&
          event.source !== self &&
          !isEnemy(event.source),
      },
      bide
    );
    k.on(
      "statusApplied",
      "a4",
      {
        subject: "otherAlly",
        limitPerTurn: 1,
        when: (event, self) =>
          event.target === self && event.status?.family === "shield",
      },
      bide
    );
    // Energy Regeneration from a teammate (enemy hits and his own excluded).
    k.on(
      "energyGained",
      "a4",
      {
        when: (event, self) =>
          event.source !== undefined &&
          event.source !== self &&
          !isEnemy(event.source),
      },
      (ctx) => gainCoreflame(ctx, k.traceParam(2, 3) * ctx.weight)
    );
  }

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setEnergy(ctx.self, 0);
    if (k.a(1)) gainCoreflame(ctx, k.traceParam(1, 2));
    if (k.e(6)) gainCoreflame(ctx, k.rankParam(6, 2));
    if (k.a(3)) ctx.applyStatus(ctx.self, shineWithValor);
  });

  // Talent: targeted by an enemy attack (aggro share) or by a teammate's
  // ability aimed at Phainon (one ally named as him, or all allies).
  k.on("hitByEnemy", "talent", {}, (ctx) => gainCoreflame(ctx, ctx.weight));
  k.on(
    "actionStart",
    "talent",
    {
      subject: "otherAlly",
      when: (event, self) =>
        event.abilityTarget === "allies" ||
        (event.abilityTarget === "ally" && event.target === self),
    },
    (ctx) => {
      gainCoreflame(ctx, ctx.weight);
      ctx.applyStatus(ctx.self, pyricCorpus);
    }
  );

  // Coreflame replaces his Energy: the engine bar is kept empty.
  const clearEnergy = (ctx: BattleApi) => ctx.setEnergy(ctx.self, 0);
  k.on("actionEnd", "a4", { subject: "ally" }, clearEnergy);
  k.on("turnEnd", "a4", { subject: "enemy" }, clearEnergy);

  // Khaslana: "After using an attack, restores HP equal to #7 of his Max HP."
  k.on(
    "actionEnd",
    "talent",
    { attack: true, when: (_event, self) => self.has(khaslana) },
    (ctx) => {
      const boost = 1 + ctx.self.currentStat("outgoingHealing");
      ctx.heal(ctx.self, k.param("05", 7) * boost);
    }
  );

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
        if (ally === ctx.self || ally.departed) continue;
        ctx.setCounter(ally, "1408:departed", 1);
        ctx.setDeparted(ally, true);
      }
      // The Territory's Physical Weakness is removed when it ends, only where
      // it was not native.
      for (const enemy of ctx.enemies) {
        if (enemy.weaknesses.has("Physical")) continue;
        ctx.setCounter(enemy, "1408:implanted", 1);
        ctx.implantWeakness(enemy, "Physical");
      }
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

  // Enemies' forced actions are not simulated: each adds a Soulscorch stack,
  // and the Counter follows the Edict at once.
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
    after: (ctx) => {
      ctx.queueAction(ctx.self, "soulscorchCounter");
      nextKhaslanaTurn(ctx);
    },
  });

  // The Counter is its own Follow-Up ATK (ability config: Insert), also
  // Skill DMG. Facts: Toughness 10 (first slot) per random instance and 5
  // (AoE slot) per enemy.
  k.ability({
    id: "soulscorchCounter",
    kind: "followUp",
    tags: ["skill"],
    hits: [
      { shape: "aoe", each: k.param("09", 1), toughness: { each: 5 } },
      {
        shape: "bounce",
        each: k.param("09", 4),
        bounces: k.param("09", 3),
        toughness: { each: 10 },
      },
    ],
    after: (ctx) => ctx.removeStatus(ctx.self, soulscorch),
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
        if (ally.counter("1408:departed") > 0) {
          ctx.setCounter(ally, "1408:departed", 0);
          ctx.setDeparted(ally, false);
        }
        ctx.applyStatus(ally, allySpeed);
      }
      for (const enemy of ctx.enemies) {
        if (enemy.counter("1408:implanted") <= 0) continue;
        ctx.setCounter(enemy, "1408:implanted", 0);
        ctx.removeWeakness(enemy, "Physical");
      }
      if (k.a(1)) gainCoreflame(ctx, k.traceParam(1, 1));
      if (k.a(3)) ctx.applyStatus(ctx.self, shineWithValor);
    },
  });
});
