import type { ActionContext, PolicyView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Trailblazer (Destruction) — Destruction, Physical. */
export default defineCharacter("8001", (k) => {
  const pickoffModifiers: ModifierDef[] = [
    { stat: "atkPct", value: k.param("04", 1) },
  ];
  if (k.a(2))
    pickoffModifiers.push({ stat: "defPct", value: k.traceParam(2, 1) });
  const perfectPickoff = k.status({
    id: "perfect-pickoff",
    origin: "talent",
    maxStacks: k.param("04", 2),
    modifiers: pickoffModifiers,
  });

  // A6: DMG to the designated target only, while the Skill or RIP Home Run
  // is being used.
  const fightingWill = k.status({
    id: "fighting-will",
    origin: "a6",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(3, 1),
        filter: { targetRoles: ["main"] },
      },
    ],
  });

  // Kills are not simulated: when enabled, every Ultimate defeats an enemy.
  const e1Kill =
    k.e(1) && k.toggle("e1-ultimate-kill", "e1", "enemyDefeated", false);
  const e6Kill = k.e(6) && k.toggle("e6-kill", "e6", "enemyDefeated", false);

  k.on("weaknessBreak", "talent", { subject: "self" }, (ctx) =>
    ctx.applyStatus(ctx.self, perfectPickoff)
  );

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(1, 1))
    );
  }

  if (k.e(2)) {
    // ZH: after an attack, if an enemy hit has a Physical Weakness.
    k.on(
      "actionEnd",
      "e2",
      {
        attack: true,
        when: (event) =>
          (event.targetsHit ?? []).some((enemy) =>
            enemy.weaknesses.has("Physical")
          ),
      },
      (ctx) => {
        const maxHp = ctx.self.currentStat("hp");
        if (maxHp <= 0) return;
        const amount =
          k.rankParam(2, 1) *
          ctx.self.currentStat("atk") *
          (1 + ctx.self.currentStat("outgoingHealing"));
        ctx.heal(ctx.self, amount / maxHp);
      }
    );
  }

  if (k.e(4)) {
    k.stat("e4", {
      stat: "critRate",
      value: k.rankParam(4, 1),
      filter: { targetBroken: true },
    });
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
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 1),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    before: (ctx) => {
      if (k.a(3)) ctx.applyStatus(ctx.self, fightingWill);
    },
    after: (ctx) => ctx.removeStatus(ctx.self, fightingWill),
  });

  const ultimateAfter = (ctx: ActionContext) => {
    ctx.removeStatus(ctx.self, fightingWill);
    if (e1Kill) ctx.gainEnergy(ctx.self, k.rankParam(1, 1));
    if (e6Kill) ctx.applyStatus(ctx.self, perfectPickoff);
  };

  // Blowout: Farewell Hit.
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "single", main: k.param("08", 1), toughness: { main: 30 } },
    ],
    after: ultimateAfter,
  });

  // Blowout: RIP Home Run.
  k.ability({
    id: "ultimateRip",
    kind: "ultimate",
    hits: [
      {
        shape: "blast",
        main: k.param("09", 1),
        adjacent: k.param("09", 2),
        toughness: { main: 20, adjacent: 20 },
      },
    ],
    before: (ctx) => {
      if (k.a(3)) ctx.applyStatus(ctx.self, fightingWill);
    },
    after: ultimateAfter,
  });

  const neighbours = (view: PolicyView) => {
    const index = view.mainTarget ? view.enemies.indexOf(view.mainTarget) : -1;
    if (index < 0) return 0;
    return (index > 0 ? 1 : 0) + (index < view.enemies.length - 1 ? 1 : 0);
  };
  // RIP Home Run when its total beats Farewell Hit: with A6 one neighbour is
  // enough (270% x 1.25 + 162% > 450%), without it two are needed.
  const ripMultiplier =
    k.param("09", 1) * (k.a(3) ? 1 + k.traceParam(3, 1) : 1);
  k.policy({
    ultimate: (view) =>
      ripMultiplier + neighbours(view) * k.param("09", 2) > k.param("08", 1)
        ? "ultimateRip"
        : true,
  });
});
