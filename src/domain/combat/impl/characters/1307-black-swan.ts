import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";
import type { CombatType } from "../../model/stats";
import type { StatusFamily } from "../../model/tags";

/** Wind Shear, Bleed, Burn, and Shock, with the RES E1 reduces for each. */
const DOT_FAMILIES: ReadonlyArray<readonly [StatusFamily, CombatType]> = [
  ["windShear", "Wind"],
  ["bleed", "Physical"],
  ["burn", "Fire"],
  ["shock", "Thunder"],
];
const SERIAL = "black-swan:action";
const ATTACKING = "black-swan:attacking";
const NO_RESET = "black-swan:no-reset";
const E4_CHARGE = "black-swan:e4";
const A4_ACTION = "black-swan:a4-action";
const A4_STACKS = "black-swan:a4-stacks";
const E6_ACTION = "black-swan:e6-action";

function neighbours(
  enemies: readonly EnemyView[],
  enemy: EnemyView
): EnemyView[] {
  const index = enemies.indexOf(enemy);
  return [enemies[index - 1], enemies[index + 1]].filter(
    (entry): entry is EnemyView => entry !== undefined
  );
}

/** Black Swan — Nihility, Wind. */
export default defineCharacter("1307", (k) => {
  // Arcana deals #1 + #3 × stacks. The stacking part is Arcana itself; the
  // flat part is a companion DoT that ticks and detonates with it but is not
  // a second debuff.
  const arcanaBase = k.status({
    id: "arcana-base",
    origin: "talent",
    dot: { hit: { shape: "single", main: k.param("04", 1), kind: "dot" } },
  });
  const arcana = k.status({
    id: "arcana",
    origin: "talent",
    debuff: true,
    maxStacks: k.param("04", 8),
    dot: { hit: { shape: "single", main: k.param("04", 3), kind: "dot" } },
  });

  const epiphany = k.status({
    id: "epiphany",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 2) },
  });
  // Arcana under Epiphany "is considered" Wind Shear, Bleed, Burn, and
  // Shock: markers that carry only the family, so they add no debuffs.
  const epiphanyFamilies = DOT_FAMILIES.map(([family]) =>
    k.status({ id: `epiphany-${family}`, origin: "ultimate", family })
  );
  const syncEpiphanyFamilies = (ctx: BattleApi, enemy: EnemyView) => {
    const active = enemy.has(epiphany) && enemy.has(arcana);
    for (const marker of epiphanyFamilies) {
      if (active && !enemy.has(marker)) ctx.applyStatus(enemy, marker);
      else if (!active && enemy.has(marker)) ctx.removeStatus(enemy, marker);
    }
  };
  // "Take increased DMG in their turn": held only during the enemy's turn.
  const epiphanyOwnTurn = k.status({
    id: "epiphany-own-turn",
    origin: "ultimate",
    modifiers: [{ stat: "vulnerability", value: k.param("03", 3) }],
  });

  const decadence = k.status({
    id: "decadence-def",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 5) },
    modifiers: [{ stat: "defReduction", value: k.param("02", 4) }],
  });

  // Held only while Arcana deals its turn-start DMG (target and splash).
  const arcanaPierce = k.status({
    id: "arcana-def-ignore",
    origin: "talent",
    modifiers: [
      {
        stat: "defIgnore",
        value: k.param("04", 7),
        filter: { tags: ["dot"] },
      },
    ],
  });

  const e1Res = new Map<CombatType, StatusDef>(
    k.e(1)
      ? DOT_FAMILIES.map(([, type]) => [
          type,
          k.status({
            id: `e1-res-${type}`,
            origin: "e1",
            modifiers: [
              {
                stat: "resReduction",
                value: k.rankParam(1, 1),
                filter: { combatTypes: [type] },
              },
            ],
          }),
        ])
      : []
  );

  if (k.a(3)) {
    k.stat("a6", {
      stat: "dmgBoost",
      scaling: {
        source: "holder",
        stat: "effectHitRate",
        ratio: k.traceParam(3, 1),
        cap: k.traceParam(3, 2),
      },
    });
  }

  const afflictions = (enemy: EnemyView): CombatType[] =>
    DOT_FAMILIES.filter(([family]) => enemy.hasFamily(family)).map(
      ([, type]) => type
    );

  const syncE1 = (ctx: BattleApi, enemy: EnemyView) => {
    if (!k.e(1)) return;
    const types = new Set(afflictions(enemy));
    for (const [type, status] of e1Res) {
      if (!types.has(type)) ctx.removeStatus(enemy, status);
      else if (!enemy.has(status)) ctx.applyStatus(enemy, status);
    }
  };

  // E6: a 50% fixed chance of +1 stack per infliction, as an expected value.
  const e6Extra = k.e(6) ? k.rankParam(6, 1) * k.rankParam(6, 3) : 0;
  const inflictArcana = (
    ctx: BattleApi,
    enemy: EnemyView,
    stacks: number,
    baseChance: number
  ) => {
    ctx.applyStatus(enemy, arcanaBase, { baseChance });
    ctx.applyStatus(enemy, arcana, { stacks: stacks + e6Extra, baseChance });
    if (enemy.has(epiphany)) syncEpiphanyFamilies(ctx, enemy);
    syncE1(ctx, enemy);
  };

  for (const status of [epiphany, arcana]) {
    k.on("statusRemoved", status.origin, { status }, (ctx, event) => {
      if (!isEnemy(event.target)) return;
      syncEpiphanyFamilies(ctx, event.target);
      syncE1(ctx, event.target);
    });
  }

  if (k.e(1)) {
    const isAffliction = (status: StatusDef | undefined) =>
      DOT_FAMILIES.some(([family]) => family === status?.family);
    k.on(
      "statusApplied",
      "e1",
      { subject: "any", when: (event) => isAffliction(event.status) },
      (ctx, event) => {
        if (isEnemy(event.target)) syncE1(ctx, event.target);
      }
    );
  }

  k.on("actionStart", "talent", { subject: "ally" }, (ctx, event) => {
    ctx.setCounter(ctx.self, SERIAL, ctx.self.counter(SERIAL) + 1);
    ctx.setCounter(ctx.self, ATTACKING, event.attack ? 1 : 0);
    for (const enemy of ctx.enemies) syncE1(ctx, enemy);
  });

  k.on("turnStart", "talent", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!isEnemy(enemy)) return;
    for (const other of ctx.enemies) syncE1(ctx, other);
    if (enemy.has(epiphany)) {
      ctx.applyStatus(enemy, epiphanyOwnTurn);
      if (k.e(4) && enemy.counter(E4_CHARGE) > 0) {
        ctx.setCounter(enemy, E4_CHARGE, 0);
        ctx.gainEnergy(ctx.self, k.rankParam(4, 2));
      }
    }
    if (enemy.stacks(arcana) >= k.param("04", 6)) {
      ctx.applyStatus(ctx.self, arcanaPierce);
    }
  });

  k.on("turnEnd", "talent", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!isEnemy(enemy)) return;
    ctx.removeStatus(enemy, epiphanyOwnTurn);
    ctx.removeStatus(ctx.self, arcanaPierce);
  });

  /** Arcana's turn-start DMG has resolved (its flat part ticks first). */
  const afterArcanaTick = (ctx: BattleApi, enemy: EnemyView) => {
    if (enemy.stacks(arcana) >= k.param("04", 4)) {
      const adjacent = neighbours(ctx.enemies, enemy);
      if (adjacent.length > 0) {
        ctx.deal(
          { shape: "aoe", each: k.param("04", 5), kind: "dot" },
          { targets: adjacent, tags: ["dot"], origin: "talent" }
        );
        for (const other of adjacent) {
          inflictArcana(ctx, other, 1, k.param("04", 2));
        }
      }
    }
    ctx.removeStatus(ctx.self, arcanaPierce);
    if (enemy.has(epiphany) && enemy.counter(NO_RESET) > 0) {
      ctx.setCounter(enemy, NO_RESET, enemy.counter(NO_RESET) - 1);
    } else {
      // The tiny base chance keeps the stored landing chance (the maximum of
      // all applications) instead of clearing it.
      ctx.applyStatus(enemy, arcana, {
        setStacks: 1,
        baseChance: Number.EPSILON,
      });
    }
  };

  // Any DoT counts, except Frozen and Entanglement, whose DMG is Additional
  // DMG; Arcana's flat part ticks with Arcana itself.
  const isDot = (status: StatusDef | undefined) =>
    status?.dot !== undefined &&
    status !== arcanaBase &&
    status.family !== "frozen" &&
    status.family !== "entanglement";
  k.on(
    "dotTick",
    "talent",
    { subject: "enemy", when: (event) => isDot(event.status) },
    (ctx, event) => {
      const enemy = event.unit;
      if (!isEnemy(enemy)) return;
      if (!event.detonation) {
        // Turn-start DMG. Arcana resets before its own tick adds a stack.
        if (event.status === arcana) afterArcanaTick(ctx, enemy);
        inflictArcana(ctx, enemy, 1, k.param("04", 2));
        return;
      }
      if (!k.a(2) || ctx.self.counter(ATTACKING) <= 0) return;
      // A4: DoT received during an ally's attack (detonations), up to #2
      // stacks per attack and enemy.
      const serial = ctx.self.counter(SERIAL);
      if (enemy.counter(A4_ACTION) !== serial) {
        ctx.setCounter(enemy, A4_ACTION, serial);
        ctx.setCounter(enemy, A4_STACKS, 0);
      }
      if (enemy.counter(A4_STACKS) >= k.traceParam(2, 2)) return;
      ctx.setCounter(enemy, A4_STACKS, enemy.counter(A4_STACKS) + 1);
      inflictArcana(ctx, enemy, 1, k.traceParam(2, 1));
    }
  );

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) => {
      for (const enemy of ctx.enemies) {
        inflictArcana(ctx, enemy, 1, k.traceParam(2, 1));
      }
    });
  }

  if (k.e(6)) {
    k.on("hit", "e6", { subject: "otherAlly" }, (ctx, event) => {
      const enemy = event.target;
      if (!isEnemy(enemy)) return;
      const serial = ctx.self.counter(SERIAL);
      if (enemy.counter(E6_ACTION) === serial) return;
      ctx.setCounter(enemy, E6_ACTION, serial);
      inflictArcana(ctx, enemy, 1, k.rankParam(6, 2));
    });
  }

  // Kills are not simulated; when on, an Arcana-afflicted enemy next to the
  // designated target is assumed to fall to each Ultimate.
  const e2Kill = k.e(2) && k.toggle("e2-kill", "e2", "enemyDefeated", false);

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const types = afflictions(ctx.target);
      inflictArcana(ctx, ctx.target, 1, k.param("01", 2));
      for (const _ of types) {
        inflictArcana(ctx, ctx.target, 1, k.param("01", 3));
      }
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 1),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const target = ctx.target;
      const types = afflictions(target);
      for (const enemy of [target, ...neighbours(ctx.enemies, target)]) {
        inflictArcana(ctx, enemy, 1, k.param("02", 2));
        ctx.applyStatus(enemy, decadence, { baseChance: k.param("02", 3) });
      }
      if (!k.a(1)) return;
      for (const _ of types) {
        inflictArcana(ctx, target, 1, k.traceParam(1, 1));
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // Epiphany is inflicted before the DMG, so E1 already counts Arcana as
    // every DoT type for this hit.
    before: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, epiphany);
        ctx.setCounter(enemy, NO_RESET, k.param("03", 4));
        ctx.setCounter(enemy, E4_CHARGE, 1);
        syncEpiphanyFamilies(ctx, enemy);
        syncE1(ctx, enemy);
      }
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      if (e2Kill && isEnemy(ctx.target)) {
        inflictArcana(ctx, ctx.target, k.rankParam(2, 2), k.rankParam(2, 1));
      }
    },
  });

  // E4's Effect RES reduction is not modeled: enemy Effect RES has no
  // modifier (tracked as engine-gap).
});
