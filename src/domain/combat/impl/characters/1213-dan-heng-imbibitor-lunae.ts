import type { ActionContext, BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

interface Part {
  total: number;
  toughness: number;
  /** Share of the total per hit (0 where the hit skips this role). */
  ratios: readonly number[];
}

/**
 * One HitDef per hit, from the per-hit ratios of the ability config
 * (Avatar_DanHengIL_00_Ability.json); DMG and Toughness split alike.
 */
function split(main: Part, adjacent?: Part): HitDef[] {
  return main.ratios.map((ratio, index) => {
    const adjacentRatio = adjacent?.ratios[index] ?? 0;
    return adjacent && adjacentRatio > 0
      ? {
          shape: "blast",
          main: main.total * ratio,
          adjacent: adjacent.total * adjacentRatio,
          toughness: {
            main: main.toughness * ratio,
            adjacent: adjacent.toughness * adjacentRatio,
          },
        }
      : {
          shape: "single",
          main: main.total * ratio,
          toughness: { main: main.toughness * ratio },
        };
  });
}

/** Dan Heng • Imbibitor Lunae — Destruction, Imaginary. */
export default defineCharacter("1213", (k) => {
  const righteousHeart = k.status({
    id: "righteous-heart",
    origin: "talent",
    maxStacks: k.param("04", 2) + (k.e(1) ? k.rankParam(1, 1) : 0),
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 1) }],
  });
  const heartPerHit = k.e(1) ? 2 : 1; // E1: "1 extra stack for each hit"

  // E4: lasts until the end of his next turn (the applying turn is skipped).
  const outroar = k.status({
    id: "outroar",
    origin: "skill",
    ...(k.e(4) ? { duration: { turns: 1 } } : {}),
    maxStacks: k.param("02", 2),
    modifiers: [{ stat: "critDmg", value: k.param("02", 1) }],
  });

  const reignReturned = k.e(6)
    ? k.status({
        id: "e6-imaginary-res-pen",
        origin: "e6",
        maxStacks: k.rankParam(6, 2),
        modifiers: [
          {
            stat: "resPen",
            value: k.rankParam(6, 1),
            filter: { combatTypes: ["Imaginary"] },
          },
        ],
      })
    : null;

  if (k.a(3)) {
    k.stat("a6", {
      stat: "critDmg",
      value: k.traceParam(3, 1),
      filter: { targetWeakness: ["Imaginary"] },
    });
  }

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(1, 1))
    );
  }

  const maxSquama = k.param("03", 4);
  /** Squama Sacrosancta is spent before Skill Points. */
  const spend = (ctx: BattleApi, cost: number) => {
    const squama = Math.min(cost, ctx.self.counter("squama"));
    ctx.addCounter(ctx.self, "squama", -squama);
    ctx.gainSkillPoints(-(cost - squama));
  };

  /**
   * Righteous Heart after each hit; with Outroar, 1 stack before every hit
   * from the 4th (after hits 3 to n − 1, 0-based 2 to n − 2).
   */
  const afterHit =
    (count: number, outroarFrom4th: boolean) =>
    (ctx: ActionContext, index: number) => {
      ctx.applyStatus(ctx.self, righteousHeart, { stacks: heartPerHit });
      if (outroarFrom4th && index >= 2 && index < count - 1) {
        ctx.applyStatus(ctx.self, outroar);
      }
    };
  k.on("turnEnd", "talent", {}, (ctx) => {
    ctx.removeStatus(ctx.self, righteousHeart);
    if (!k.e(4)) ctx.removeStatus(ctx.self, outroar);
  });

  /**
   * Dracore Libre is not an action of its own: each enhancement level is the
   * Basic ATK variant it produces. Skill Point costs are from the facts.
   */
  const enhanced = (
    id: string,
    cost: number,
    energy: number,
    hits: HitDef[],
    options: { outroar: boolean; leap: boolean }
  ) => {
    const leap = options.leap;
    k.ability({
      id,
      kind: "basic",
      skillPoints: 0,
      energy,
      before: (ctx) => {
        spend(ctx, cost);
        if (leap && reignReturned) {
          const stacks = ctx.self.counter("reign-returned");
          if (stacks > 0) {
            ctx.applyStatus(ctx.self, reignReturned, { setStacks: stacks });
          }
        }
      },
      hits,
      afterHit: afterHit(hits.length, options.outroar),
      after: (ctx) => {
        if (leap && reignReturned) {
          ctx.removeStatus(ctx.self, reignReturned);
          ctx.setCounter(ctx.self, "reign-returned", 0);
        }
      },
    });
  };

  const basicHits = split({
    total: k.param("01", 1),
    toughness: 10,
    ratios: [0.3, 0.7],
  });
  k.ability({
    id: "basic",
    kind: "basic",
    hits: basicHits,
    afterHit: afterHit(basicHits.length, false),
  });

  enhanced(
    "transcendence",
    1,
    30,
    split({
      total: k.param("08", 1),
      toughness: 20,
      ratios: [0.33, 0.33, 0.34],
    }),
    { outroar: false, leap: false }
  );
  enhanced(
    "divineSpear",
    2,
    35,
    split(
      {
        total: k.param("10", 1),
        toughness: 30,
        ratios: [0.2, 0.2, 0.2, 0.2, 0.2],
      },
      { total: k.param("10", 2), toughness: 10, ratios: [0, 0, 0, 0.5, 0.5] }
    ),
    { outroar: true, leap: false }
  );
  enhanced(
    "fulgurantLeap",
    3,
    40,
    split(
      {
        total: k.param("12", 1),
        toughness: 40,
        ratios: [0.142, 0.142, 0.142, 0.142, 0.142, 0.142, 0.148],
      },
      {
        total: k.param("12", 2),
        toughness: 20,
        ratios: [0, 0, 0, 0.25, 0.25, 0.25, 0.25],
      }
    ),
    { outroar: true, leap: true }
  );

  const ultimateHits = split(
    { total: k.param("03", 1), toughness: 20, ratios: [0.3, 0.3, 0.4] },
    { total: k.param("03", 2), toughness: 20, ratios: [0.3, 0.3, 0.4] }
  );
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: ultimateHits,
    afterHit: afterHit(ultimateHits.length, false),
    after: (ctx) => {
      // E2: "1 extra Squama Sacrosancta" and "advances by 100%" (no placeholders).
      const squama = k.param("03", 3) + (k.e(2) ? 1 : 0);
      ctx.addCounter(ctx.self, "squama", squama, maxSquama);
      if (k.e(2)) ctx.advanceAction(ctx.self, 1);
    },
  });

  if (reignReturned) {
    k.on(
      "actionEnd",
      "e6",
      { subject: "otherAlly", abilityKinds: ["ultimate"] },
      (ctx, event) => {
        if (event.unit.kind !== "character") return;
        ctx.addCounter(ctx.self, "reign-returned", 1, k.rankParam(6, 2));
      }
    );
  }

  // Fulgurant Leap whenever Squama Sacrosancta and Skill Points cover it;
  // otherwise Basic ATK to rebuild Skill Points.
  k.policy({
    turn: (view) =>
      view.skillPoints + view.self.counter("squama") >= 3 - 1e-9
        ? "fulgurantLeap"
        : "basic",
  });
});
