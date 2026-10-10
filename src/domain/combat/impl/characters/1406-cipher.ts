import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";
import type { DamageTag } from "../../model/tags";

const PATRON_HIT = "cipher:patron-hit";
const FOLLOW_UPS = "cipher:follow-ups";

/** Cipher — Nihility, Quantum. */
export default defineCharacter("1406", (k) => {
  const patron = k.status({ id: "patron", origin: "talent" });

  // The tally (#2 of allies' non-True DMG to the Patron, released as True
  // DMG by the Ultimate: #2 + #3 = 100% of it) is modeled as True DMG added
  // to every ally hit when it is dealt, credited to the attacker. The Engine
  // cannot filter by target, so hits on other enemies use the Patron rate
  // too (A4 tallies them at a lower rate). E1 scales every tally; E6 returns
  // #1 of each cleared tally, i.e. 1/(1 − #1) over repeated Ultimates.
  const tallyScale =
    (k.e(1) ? k.rankParam(1, 3) : 1) *
    (k.e(6) ? 1 / (1 - k.rankParam(6, 1)) : 1);
  // A2: "When Cipher's SPD is higher than or equal to 140/170" (no
  // parameters), the gained tally increases by #3/#4.
  const tallyModifiers = (
    rate: number,
    tags?: readonly DamageTag[]
  ): ModifierDef[] => {
    const filter = tags ? { tags } : undefined;
    const value = rate * tallyScale;
    const modifiers: ModifierDef[] = [{ stat: "trueDmg", value, filter }];
    if (k.a(1)) {
      modifiers.push(
        {
          stat: "trueDmg",
          filter,
          scaling: {
            source: "applier",
            stat: "spd",
            atLeast: 140,
            ratio: value * k.traceParam(1, 3),
          },
        },
        {
          stat: "trueDmg",
          filter,
          scaling: {
            source: "applier",
            stat: "spd",
            atLeast: 170,
            ratio: value * (k.traceParam(1, 4) - k.traceParam(1, 3)),
          },
        }
      );
    }
    return modifiers;
  };
  // Break-family hits only take True DMG modifiers that name them.
  for (const modifier of [
    ...tallyModifiers(k.param("04", 2)),
    ...tallyModifiers(k.param("04", 2), ["break", "superBreak"]),
  ]) {
    k.teamStat("talent", modifier);
  }
  if (k.e(6)) {
    for (const modifier of tallyModifiers(k.rankParam(6, 3), ["followUp"])) {
      k.stat("e6", modifier);
    }
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 2),
      filter: { tags: ["followUp"] },
    });
  }

  if (k.a(1)) {
    k.stat("a2", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: 140,
        ratio: k.traceParam(1, 1),
      },
    });
    k.stat("a2", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: 170,
        ratio: k.traceParam(1, 2) - k.traceParam(1, 1),
      },
    });
  }

  const sleightOfSky = k.status({
    id: "sleight-of-sky",
    origin: "a6",
    modifiers: [{ stat: "vulnerability", value: k.traceParam(3, 1) }],
  });
  if (k.a(3)) {
    k.stat("a6", {
      stat: "critDmg",
      value: k.traceParam(3, 2),
      filter: { tags: ["followUp"] },
    });
  }

  const skillAtk = k.status({
    id: "jackpot-atk",
    origin: "skill",
    duration: { turns: k.param("02", 4) },
    modifiers: [{ stat: "atkPct", value: k.param("02", 5) }],
  });
  const e1Atk = k.status({
    id: "read-the-room",
    origin: "e1",
    duration: { turns: k.rankParam(1, 2) },
    modifiers: [{ stat: "atkPct", value: k.rankParam(1, 1) }],
  });
  const e2Vulnerability = k.status({
    id: "in-the-fray",
    origin: "e2",
    debuff: true,
    duration: { turns: k.rankParam(2, 1) },
    modifiers: [{ stat: "vulnerability", value: k.rankParam(2, 3) }],
  });

  const makePatron = (ctx: BattleApi, target: EnemyView) => {
    for (const enemy of ctx.enemies) {
      if (enemy !== target) ctx.removeStatus(enemy, patron);
    }
    ctx.applyStatus(target, patron);
  };

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    // The highest-Max-HP enemy: the scenario's main target (the boss).
    const boss = ctx.enemies[Math.floor((ctx.enemies.length - 1) / 2)];
    if (boss) makePatron(ctx, boss);
    if (k.a(3)) {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, sleightOfSky);
    }
  });

  // Skill Weaken (enemy DMG dealt) is not modeled.
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
    before: (ctx) => {
      if (isEnemy(ctx.target)) makePatron(ctx, ctx.target);
      ctx.applyStatus(ctx.self, skillAtk);
    },
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (isEnemy(ctx.target)) makePatron(ctx, ctx.target);
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
      {
        shape: "blast",
        main: k.param("03", 4),
        adjacent: k.param("03", 4),
        toughness: { adjacent: 20 },
      },
    ],
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    before: (ctx) => {
      if (k.e(1)) ctx.applyStatus(ctx.self, e1Atk);
    },
    hits: [
      { shape: "single", main: k.param("04", 1), toughness: { main: 20 } },
    ],
  });

  // "...up to #3 time(s) per turn, and this trigger count resets at the
  // start of Cipher's turn."
  k.on("turnStart", "talent", { subject: "self" }, (ctx) =>
    ctx.setCounter(ctx.self, FOLLOW_UPS, 0)
  );
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, PATRON_HIT, 0)
  );
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    if (event.tags?.includes("dot")) return;
    if (isEnemy(event.target) && event.target.has(patron)) {
      ctx.setCounter(ctx.self, PATRON_HIT, 1);
    }
  });
  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (ctx.self.counter(PATRON_HIT) === 0) return;
      ctx.setCounter(ctx.self, PATRON_HIT, 0);
      const target = ctx.enemies.find((enemy) => enemy.has(patron));
      if (!target) return;
      if (k.e(4)) {
        ctx.deal(
          {
            shape: "single",
            main: k.rankParam(4, 1),
            onlyTags: ["additional"],
          },
          { targets: [target], origin: "e4" }
        );
      }
      if (
        event.unit !== ctx.self &&
        ctx.self.counter(FOLLOW_UPS) < k.param("04", 3)
      ) {
        ctx.setCounter(ctx.self, FOLLOW_UPS, ctx.self.counter(FOLLOW_UPS) + 1);
        ctx.queueAction(ctx.self, "followUp", { target });
      }
    }
  );

  if (k.e(2)) {
    k.on("hit", "e2", { subject: "self" }, (ctx, event) => {
      if (isEnemy(event.target)) {
        ctx.applyStatus(event.target, e2Vulnerability, {
          baseChance: k.rankParam(2, 2),
        });
      }
    });
  }
});
