import { type ActionContext, type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/**
 * Splits an n-hit attack into one HitDef per hit. Per-hit ratios are not in
 * the reference data, so DMG and Toughness are split evenly (needs-data).
 * `adjacent` starts at hit `from` (1-based) and is split over the rest.
 */
function perHit(
  count: number,
  main: { total: number; toughness: number },
  adjacent?: { from: number; total: number; toughness: number }
): HitDef[] {
  const adjacentHits = adjacent ? count - adjacent.from + 1 : 0;
  return Array.from({ length: count }, (_, index) => {
    const hasAdjacent = adjacent !== undefined && index + 1 >= adjacent.from;
    return hasAdjacent
      ? {
          shape: "blast",
          main: main.total / count,
          adjacent: adjacent.total / adjacentHits,
          toughness: {
            main: main.toughness / count,
            adjacent: adjacent.toughness / adjacentHits,
          },
        }
      : {
          shape: "single",
          main: main.total / count,
          toughness: { main: main.toughness / count },
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

  // Stacks gained "after each hit" (and Outroar "before every hit" from the
  // 4th) must land between hits. Hit events fire once per target, so the
  // action's hit boundaries are counted in events from its targets.
  let hitEnds: number[] = [];
  let hitEvents = 0;
  let outroarHits = false;
  const planHits = (
    ctx: ActionContext,
    hits: readonly HitDef[],
    outroarFrom4th: boolean
  ) => {
    const index = isEnemy(ctx.target) ? ctx.enemies.indexOf(ctx.target) : -1;
    const neighbours =
      index < 0
        ? 0
        : (ctx.enemies[index - 1] ? 1 : 0) + (ctx.enemies[index + 1] ? 1 : 0);
    let events = 0;
    hitEnds = hits.map((hit) => {
      events += hit.shape === "blast" ? 1 + neighbours : 1;
      return events;
    });
    hitEvents = 0;
    outroarHits = outroarFrom4th;
  };
  k.on("hit", "talent", { abilityKinds: ["basic", "ultimate"] }, (ctx) => {
    hitEvents += 1;
    const hit = hitEnds.indexOf(hitEvents);
    if (hit < 0) return;
    ctx.applyStatus(ctx.self, righteousHeart, { stacks: heartPerHit });
    // Hit index is 0-based: after the 3rd hit, before the 4th onward.
    if (outroarHits && hit >= 2 && hit < hitEnds.length - 1) {
      ctx.applyStatus(ctx.self, outroar);
    }
  });
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
        planHits(ctx, hits, options.outroar);
        if (leap && reignReturned) {
          const stacks = ctx.self.counter("reign-returned");
          if (stacks > 0) {
            ctx.applyStatus(ctx.self, reignReturned, { setStacks: stacks });
          }
        }
      },
      hits,
      after: (ctx) => {
        if (leap && reignReturned) {
          ctx.removeStatus(ctx.self, reignReturned);
          ctx.setCounter(ctx.self, "reign-returned", 0);
        }
      },
    });
  };

  const basicHits = perHit(2, { total: k.param("01", 1), toughness: 10 });
  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => planHits(ctx, basicHits, false),
    hits: basicHits,
  });

  enhanced(
    "transcendence",
    1,
    30,
    perHit(3, { total: k.param("08", 1), toughness: 20 }),
    { outroar: false, leap: false }
  );
  enhanced(
    "divineSpear",
    2,
    35,
    perHit(
      5,
      { total: k.param("10", 1), toughness: 30 },
      { from: 4, total: k.param("10", 2), toughness: 10 }
    ),
    { outroar: true, leap: false }
  );
  enhanced(
    "fulgurantLeap",
    3,
    40,
    perHit(
      7,
      { total: k.param("12", 1), toughness: 40 },
      { from: 4, total: k.param("12", 2), toughness: 20 }
    ),
    { outroar: true, leap: true }
  );

  const ultimateHits = perHit(
    3,
    { total: k.param("03", 1), toughness: 20 },
    { from: 1, total: k.param("03", 2), toughness: 20 }
  );
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => planHits(ctx, ultimateHits, false),
    hits: ultimateHits,
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
