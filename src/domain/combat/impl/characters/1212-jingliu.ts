import {
  type ActionContext,
  type BattleApi,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Jingliu — Destruction, Ice. */
export default defineCharacter("1212", (k) => {
  // "Syzygy can stack up to 3 times" (no placeholder); E6 raises it by 1 for
  // the Spectral Transmigration state, which ends with 0 stacks.
  const baseMaxSyzygy = 3;
  const maxSyzygy = (unit: UnitView) =>
    baseMaxSyzygy + (k.e(6) && unit.has(transmigration) ? 1 : 0);

  const transmigrationModifiers: ModifierDef[] = [
    { stat: "critRate", value: k.param("04", 7) },
  ];
  if (k.a(1)) {
    transmigrationModifiers.push({
      stat: "effectRes",
      value: k.traceParam(1, 1),
    });
  }
  if (k.a(3)) {
    transmigrationModifiers.push({
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { tags: ["ultimate"] },
    });
  }
  if (k.e(6)) {
    transmigrationModifiers.push({ stat: "critDmg", value: k.rankParam(6, 2) });
  }
  const transmigration = k.status({
    id: "spectral-transmigration",
    origin: "talent",
    modifiers: transmigrationModifiers,
  });

  // ATK from teammates' HP, held as stacks worth 100% base ATK each so the
  // cap ("of her base ATK") is the stack limit.
  const atkRatio = k.param("04", 3) + (k.e(4) ? k.rankParam(4, 1) : 0);
  const atkCap = k.param("04", 4) + (k.e(4) ? k.rankParam(4, 2) : 0);
  const moonlight = k.status({
    id: "transmigration-atk",
    origin: "talent",
    maxStacks: atkCap,
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "holder", stat: "atkBase", ratio: 1 },
      },
    ],
  });

  const e1CritDmg = k.e(1)
    ? k.status({
        id: "e1-crit-dmg",
        origin: "e1",
        duration: { turns: k.rankParam(1, 3) },
        modifiers: [{ stat: "critDmg", value: k.rankParam(1, 1) }],
      })
    : null;

  const e2Boost = k.e(2)
    ? k.status({
        id: "e2-enhanced-skill-dmg",
        origin: "e2",
        modifiers: [
          {
            stat: "dmgBoost",
            value: k.rankParam(2, 1),
            filter: { tags: ["skill"] },
          },
        ],
      })
    : null;

  const gainSyzygy = (ctx: BattleApi, stacks: number) => {
    ctx.addCounter(ctx.self, "syzygy", stacks, maxSyzygy(ctx.self));
    if (
      ctx.self.has(transmigration) ||
      ctx.self.counter("syzygy") < k.param("04", 5) - 1e-9
    ) {
      return;
    }
    ctx.applyStatus(ctx.self, transmigration);
    ctx.advanceAction(ctx.self, k.param("04", 6));
    if (k.e(6)) {
      ctx.addCounter(
        ctx.self,
        "syzygy",
        k.rankParam(6, 1),
        maxSyzygy(ctx.self)
      );
    }
  };

  /** E1 rider on the Ultimate and Enhanced Skill. */
  const e1Before = (ctx: ActionContext) => {
    if (e1CritDmg) ctx.applyStatus(ctx.self, e1CritDmg);
  };
  const e1After = (ctx: ActionContext, tag: "skill" | "ultimate") => {
    if (!k.e(1) || !isEnemy(ctx.target)) return;
    const index = ctx.enemies.indexOf(ctx.target);
    if (ctx.enemies[index - 1] || ctx.enemies[index + 1]) return;
    // "If only one enemy target is attacked": part of the same attack, so it
    // carries the ability's DMG type.
    ctx.deal(
      { shape: "single", main: k.rankParam(1, 2) },
      { targets: [ctx.target], tags: [tag], origin: "e1" }
    );
  };

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
    energy: 20,
    usable: (view) => !view.self.has(transmigration),
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (k.a(2)) ctx.advanceAction(ctx.self, k.traceParam(2, 1));
      gainSyzygy(ctx, k.param("02", 2));
    },
  });

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    skillPoints: 0,
    usable: (view) => view.self.has(transmigration),
    before: (ctx) => {
      e1Before(ctx);
      if (e2Boost && ctx.self.counter("e2-pending") > 0) {
        ctx.setCounter(ctx.self, "e2-pending", 0);
        ctx.applyStatus(ctx.self, e2Boost);
      }
    },
    hits: [
      {
        shape: "blast",
        main: k.param("09", 1),
        adjacent: k.param("09", 3),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      e1After(ctx, "skill");
      if (e2Boost) ctx.removeStatus(ctx.self, e2Boost);
      ctx.addCounter(ctx.self, "syzygy", -k.param("09", 2));
      if (ctx.self.counter("syzygy") <= 1e-9) {
        ctx.setCounter(ctx.self, "syzygy", 0);
        ctx.removeStatus(ctx.self, transmigration);
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: e1Before,
    hits: [
      {
        shape: "blast",
        main: k.param("03", 1),
        adjacent: k.param("03", 3),
        toughness: { main: 20, adjacent: 20 },
      },
    ],
    after: (ctx) => {
      e1After(ctx, "ultimate");
      if (e2Boost) ctx.setCounter(ctx.self, "e2-pending", 1);
      gainSyzygy(ctx, k.param("03", 2));
    },
  });

  // Each attack in Spectral Transmigration consumes teammates' HP (down to
  // the engine's HP floor; memosprites are not teammates) and converts the
  // HP actually consumed into ATK until the attack ends.
  k.on("actionStart", "talent", { attack: true }, (ctx) => {
    if (!ctx.self.has(transmigration) || ctx.weight <= 0) return;
    let consumed = 0;
    for (const ally of ctx.allies) {
      if (ally === ctx.self || ally.kind !== "character") continue;
      const share = ctx.consumeHp(ally, k.param("04", 2)) / ctx.weight;
      consumed += share * ally.panelStat("hp");
    }
    const baseAtk = ctx.self.panelStat("atkBase");
    if (baseAtk <= 0) return;
    ctx.applyStatus(ctx.self, moonlight, {
      setStacks: Math.min(atkCap, (atkRatio * consumed) / baseAtk),
    });
  });
  k.on("actionEnd", "talent", {}, (ctx) =>
    ctx.removeStatus(ctx.self, moonlight)
  );

  // Two Skills enter Spectral Transmigration; the Ultimate is held for it
  // (A6, CRIT Rate, HP-converted ATK) unless Syzygy is already full.
  k.policy({
    turn: (view) =>
      view.self.has(transmigration)
        ? "enhancedSkill"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
    ultimate: (view) =>
      view.self.has(transmigration) &&
      view.self.counter("syzygy") < maxSyzygy(view.self) - 1e-9,
  });
});
