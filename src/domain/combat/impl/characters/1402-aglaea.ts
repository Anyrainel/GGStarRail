import {
  type ActionContext,
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";

/** Aglaea — Remembrance, Lightning. */
export default defineCharacter("1402", (k) => {
  const GARMENTMAKER = "11402";

  // Tracker aglaea-seam-stitch-debuff: "inflicts the target with Seam
  // Stitch" is treated as a debuff.
  const seamStitch = k.status({
    id: "seam-stitch",
    origin: "talent",
    debuff: true,
    modifiers: k.e(1)
      ? [{ stat: "vulnerability", value: k.rankParam(1, 1) }]
      : [],
  });

  const maxSpeedStacks =
    k.param("1140203", 3) + (k.e(4) ? k.rankParam(4, 1) : 0);
  const garmentmakerSpeed = k.status({
    id: "garmentmaker-spd",
    origin: "memospriteTalent",
    maxStacks: maxSpeedStacks,
    modifiers: [{ stat: "spdFlat", value: k.param("1140203", 1) }],
  });
  const supremeStance = k.status({ id: "supreme-stance", origin: "ultimate" });
  // Supreme Stance copies Garmentmaker's SPD Boost stacks as SPD% on Aglaea.
  const supremeSpeed = k.status({
    id: "supreme-stance-spd",
    origin: "ultimate",
    maxStacks: maxSpeedStacks,
    modifiers: [{ stat: "spdPct", value: k.param("03", 1) }],
  });
  // A2 reads both units' current SPD; its stacks hold the flat ATK.
  const myopicDoom = k.status({
    id: "myopic-doom",
    origin: "a2",
    maxStacks: Number.MAX_SAFE_INTEGER,
    modifiers: [{ stat: "atkFlat", value: 1 }],
  });
  const e2DefIgnore = k.status({
    id: "e2-def-ignore",
    origin: "e2",
    maxStacks: k.rankParam(2, 2),
    modifiers: [{ stat: "defIgnore", value: k.rankParam(2, 1) }],
  });
  const e6ResPen = k.status({
    id: "e6-res-pen",
    origin: "e6",
    modifiers: [
      {
        stat: "resPen",
        value: k.rankParam(6, 1),
        filter: { combatTypes: ["Thunder"] },
      },
    ],
  });
  // E6 Joint ATK DMG per unit from its own SPD; one stack is 1%.
  const e6Joint = k.status({
    id: "e6-joint-dmg",
    origin: "e6",
    maxStacks: 100,
    modifiers: [{ stat: "dmgBoost", value: 0.01, filter: { tags: ["joint"] } }],
  });
  // Printed without placeholders: "greater than 160/240/320".
  const jointBonus = (speed: number): number => {
    if (speed > 320) return k.rankParam(6, 4);
    if (speed > 240) return k.rankParam(6, 3);
    if (speed > 160) return k.rankParam(6, 2);
    return 0;
  };

  const findGarmentmaker = (ctx: BattleApi, aglaea: UnitView) =>
    ctx.findSummon(aglaea, GARMENTMAKER);
  const garmentmakerPresent = (view: PolicyView) =>
    view.allies.some(
      (unit) => unit.owner === view.self && unit.definitionId === GARMENTMAKER
    );

  /** Sync a status to a stack count derived from battle state. */
  const syncStacks = (
    ctx: BattleApi,
    unit: UnitView,
    status: StatusDef,
    stacks: number
  ) => {
    if (stacks <= 1e-9) ctx.removeStatus(unit, status);
    else if (unit.has(status)) ctx.setStatusStacks(unit, status, stacks);
    else ctx.applyStatus(unit, status, { setStacks: stacks });
  };

  /** SPD-derived effects: Supreme Stance SPD, A2 ATK, and E6 Joint ATK DMG. */
  const syncSpeed = (ctx: BattleApi, aglaea: UnitView) => {
    const garmentmaker = findGarmentmaker(ctx, aglaea);
    const inStance = aglaea.has(supremeStance) && garmentmaker !== null;
    syncStacks(
      ctx,
      aglaea,
      supremeSpeed,
      inStance ? (garmentmaker?.stacks(garmentmakerSpeed) ?? 0) : 0
    );
    const units = garmentmaker ? [aglaea, garmentmaker] : [aglaea];
    if (k.a(1)) {
      const atk =
        inStance && garmentmaker
          ? k.traceParam(1, 1) * aglaea.speed +
            k.traceParam(1, 2) * garmentmaker.speed
          : 0;
      for (const unit of units) syncStacks(ctx, unit, myopicDoom, atk);
    }
    if (k.e(6)) {
      for (const unit of units) {
        syncStacks(
          ctx,
          unit,
          e6Joint,
          Math.round(jointBonus(unit.speed) * 100)
        );
      }
    }
  };

  const gainSpeedStack = (ctx: BattleApi, garmentmaker: UnitView) => {
    ctx.applyStatus(garmentmaker, garmentmakerSpeed);
    syncSpeed(ctx, ctx.self.owner ?? ctx.self);
  };

  const summonGarmentmaker = (ctx: BattleApi, aglaea: UnitView) => {
    const garmentmaker = ctx.summon(aglaea, GARMENTMAKER);
    ctx.advanceAction(garmentmaker, k.param("1140205", 1));
    // A4: retained SPD Boost stacks return with the next summon.
    const retained = aglaea.counter("retained-spd");
    if (retained > 0) {
      ctx.applyStatus(garmentmaker, garmentmakerSpeed, { setStacks: retained });
    }
    if (k.e(2) && aglaea.has(e2DefIgnore)) {
      ctx.applyStatus(garmentmaker, e2DefIgnore, {
        setStacks: aglaea.stacks(e2DefIgnore),
      });
    }
    return garmentmaker;
  };

  /** Garmentmaker self-destructs: Energy, A4 retention, end of Supreme Stance. */
  const garmentmakerLeaves = (ctx: BattleApi, aglaea: UnitView) => {
    const garmentmaker = findGarmentmaker(ctx, aglaea);
    if (!garmentmaker) return;
    if (k.a(2)) {
      ctx.setCounter(
        aglaea,
        "retained-spd",
        Math.min(garmentmaker.stacks(garmentmakerSpeed), k.traceParam(2, 1))
      );
    }
    ctx.gainEnergy(aglaea, k.param("1140206", 1));
    ctx.dismiss(garmentmaker);
    for (const status of [supremeStance, supremeSpeed, myopicDoom, e6ResPen]) {
      ctx.removeStatus(aglaea, status);
    }
    syncSpeed(ctx, aglaea);
  };

  /** While Garmentmaker is on the field, Aglaea's attacks move Seam Stitch. */
  const stitch = (ctx: ActionContext) => {
    const target = ctx.target;
    if (!isEnemy(target) || !findGarmentmaker(ctx, ctx.self)) return;
    for (const enemy of ctx.enemies) {
      if (enemy !== target) ctx.removeStatus(enemy, seamStitch);
    }
    ctx.applyStatus(target, seamStitch);
  };

  k.ability({
    id: "basic",
    kind: "basic",
    usable: (view) => !view.self.has(supremeStance),
    before: stitch,
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "self",
    energy: 20,
    usable: (view) => !view.self.has(supremeStance),
    before: (ctx) => {
      // Healing Garmentmaker is not modeled.
      if (findGarmentmaker(ctx, ctx.self)) return;
      summonGarmentmaker(ctx, ctx.self);
      ctx.advanceAction(ctx.self, 1);
    },
  });

  // Joint ATK: Aglaea's part is the ability's hit (with the Toughness, which
  // the facts give for the whole ability); Garmentmaker deals its own part.
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    tags: ["joint"],
    skillPoints: 0,
    usable: (view) => view.self.has(supremeStance),
    before: stitch,
    hits: [
      {
        shape: "blast",
        main: k.param("08", 1),
        adjacent: k.param("08", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      const garmentmaker = findGarmentmaker(ctx, ctx.self);
      if (!garmentmaker) return;
      ctx.deal(
        { shape: "blast", main: k.param("08", 3), adjacent: k.param("08", 4) },
        {
          attacker: garmentmaker,
          targets: isEnemy(ctx.target) ? [ctx.target] : undefined,
          tags: ["basic", "joint", "memosprite"],
        }
      );
    },
  });

  const countdown = k.summon({
    id: "supreme-stance-countdown",
    speed: k.param("03", 4),
    policy: () => "end",
    abilities: [
      {
        id: "end",
        kind: "other",
        target: "none",
        after: (ctx) => {
          const aglaea = ctx.self.owner;
          if (aglaea) garmentmakerLeaves(ctx, aglaea);
          ctx.dismiss(ctx.self);
        },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    before: (ctx) => {
      // Restoring Garmentmaker's HP is not modeled.
      const garmentmaker =
        findGarmentmaker(ctx, ctx.self) ?? summonGarmentmaker(ctx, ctx.self);
      ctx.applyStatus(ctx.self, supremeStance);
      if (k.e(6)) {
        ctx.applyStatus(ctx.self, e6ResPen);
        ctx.applyStatus(garmentmaker, e6ResPen);
      }
      // Using the Ultimate again resets the countdown.
      ctx.summon(ctx.self, countdown.id);
      ctx.advanceAction(ctx.self, 1);
      syncSpeed(ctx, ctx.self);
    },
  });

  k.memosprite({
    servantId: GARMENTMAKER,
    speed: { ownerRatio: k.param("04", 4) },
    abilities: [
      {
        id: "thornedSnare",
        kind: "memospriteSkill",
        energy: 10,
        hits: [
          {
            shape: "blast",
            main: k.param("1140201", 1),
            adjacent: k.param("1140201", 2),
            toughness: { main: 10, adjacent: 5 },
          },
        ],
      },
    ],
    // Prioritizes enemies under Seam Stitch.
    policy: (view) => {
      const stitched = view.enemies.find((enemy) => enemy.has(seamStitch));
      return stitched
        ? { ability: "thornedSnare", target: stitched }
        : "thornedSnare";
    },
  });

  const hitStitched = (targets: readonly UnitView[] | undefined) =>
    targets?.find((enemy) => enemy.has(seamStitch));

  // Attacks by Aglaea or Garmentmaker on the Seam Stitch target.
  k.on(
    "actionEnd",
    "talent",
    {
      subject: "selfOrMemosprite",
      attack: true,
      when: (event) => hitStitched(event.targetsHit) !== undefined,
    },
    (ctx, event) => {
      const target = hitStitched(event.targetsHit);
      if (!isEnemy(target)) return;
      ctx.deal(
        { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
        { targets: [target], abilityId: "seamStitch" }
      );
      if (k.e(1)) ctx.gainEnergy(ctx.self, k.rankParam(1, 2));
    }
  );

  k.on(
    "actionEnd",
    "memospriteTalent",
    {
      subject: "memosprite",
      attack: true,
      when: (event) => hitStitched(event.targetsHit) !== undefined,
    },
    (ctx, event) => gainSpeedStack(ctx, event.unit)
  );

  if (k.e(4)) {
    k.on("actionEnd", "e4", { subject: "self", attack: true }, (ctx) => {
      const garmentmaker = findGarmentmaker(ctx, ctx.self);
      if (garmentmaker) gainSpeedStack(ctx, garmentmaker);
    });
  }

  // SPD-derived values are refreshed before Aglaea and Garmentmaker act.
  k.on(
    "actionStart",
    "ultimate",
    {
      subject: "selfOrMemosprite",
      when: (event) => event.unit.kind !== "summon",
    },
    (ctx) => syncSpeed(ctx, ctx.self)
  );

  if (k.e(2)) {
    k.on(
      "turnStart",
      "e2",
      {
        subject: "selfOrMemosprite",
        when: (event) => event.unit.kind !== "summon",
      },
      (ctx) => {
        const garmentmaker = findGarmentmaker(ctx, ctx.self);
        for (const unit of garmentmaker
          ? [ctx.self, garmentmaker]
          : [ctx.self]) {
          ctx.applyStatus(unit, e2DefIgnore);
        }
      }
    );
    const clearE2 = (ctx: BattleApi) => {
      ctx.removeStatus(ctx.self, e2DefIgnore);
      const garmentmaker = findGarmentmaker(ctx, ctx.self);
      if (garmentmaker) ctx.removeStatus(garmentmaker, e2DefIgnore);
    };
    // "Until any unit, other than Aglaea or Garmentmaker, actively uses an
    // ability": follow-ups and countdowns are not active abilities.
    k.on(
      "actionStart",
      "e2",
      {
        subject: "any",
        abilityKinds: [
          "basic",
          "skill",
          "ultimate",
          "memospriteSkill",
          "elationSkill",
        ],
        when: (event, self) => event.unit !== self && event.unit.owner !== self,
      },
      clearE2
    );
    k.on("enemyAttack", "e2", { subject: "enemy" }, clearE2);
  }

  if (k.a(3)) {
    k.on("battleStart", "a6", { subject: "any" }, (ctx) => {
      const { energy, maxEnergy } = ctx.self;
      if (energy < k.traceParam(3, 1) * maxEnergy) {
        ctx.setEnergy(ctx.self, k.traceParam(3, 2) * maxEnergy);
      }
    });
  }

  // Skill only to summon Garmentmaker; Supreme Stance turns use the
  // enhanced Basic ATK.
  k.policy({
    turn: (view) => {
      if (view.self.has(supremeStance)) return "enhancedBasic";
      return !garmentmakerPresent(view) && view.skillPoints >= 1
        ? "skill"
        : "basic";
    },
  });
});
