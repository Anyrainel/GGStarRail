import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { TurnDuration } from "../../kit/model";

/** Trailblazer (Harmony) — Harmony, Imaginary. */
export default defineCharacter("8005", (k) => {
  const dancerDuration: TurnDuration = {
    turns: k.param("03", 1),
    countdown: "turnStart",
    clock: "applier",
  };
  const backupDancer = k.status({
    id: "backup-dancer",
    origin: "ultimate",
    duration: dancerDuration,
    modifiers: [
      { stat: "breakEffect", value: k.param("03", 3) },
      // #2 (100%) is the Toughness-to-Super-Break conversion rate.
      { stat: "superBreakDmg", value: k.param("03", 2) },
    ],
  });
  // A2 is read as raising the Backup Dancer conversion rate (community
  // calculators: 160% against one enemy) rather than DMG Boost (tracker
  // trailblazer-harmony-a2-zone). Tiers #1..#5 are ≥5, 4, 3, 2, 1 enemies.
  const danceTiers = k.a(1)
    ? [1, 2, 3, 4, 5].map((index) =>
        k.status({
          id: `dance-with-the-one-${index}`,
          origin: "a2",
          duration: dancerDuration,
          modifiers: [{ stat: "superBreakDmg", value: k.traceParam(1, index) }],
        })
      )
    : [];
  const jailbreaking = k.status({
    id: "jailbreaking-rainbowwalk",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "energyRegen", value: k.rankParam(2, 1) }],
  });

  if (k.e(4)) {
    k.teamStat(
      "e4",
      {
        stat: "breakEffect",
        scaling: {
          source: "applier",
          stat: "breakEffect",
          ratio: k.rankParam(4, 1),
        },
      },
      "otherAllies"
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // "Additionally deals DMG for 4 times" has no placeholder. Bounce facts
  // list Energy per hit (6), as for Welt and Sampo.
  const bounces = 4 + (k.e(6) ? k.rankParam(6, 1) : 0);
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 6 * (1 + bounces),
    hits: [
      {
        shape: "single",
        main: k.param("02", 1),
        toughness: { main: 10 * (1 + (k.a(2) ? k.traceParam(2, 1) : 0)) },
      },
      {
        shape: "bounce",
        each: k.param("02", 1),
        bounces,
        toughness: { each: 10 },
      },
    ],
    after: (ctx) => {
      if (k.e(1) && ctx.self.counter("e1-first-skill") === 0) {
        ctx.setCounter(ctx.self, "e1-first-skill", 1);
        ctx.gainSkillPoints(k.rankParam(1, 1));
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      const tier =
        danceTiers[Math.min(5, Math.max(1, 6 - ctx.enemies.length)) - 1];
      for (const ally of ctx.allies) {
        ctx.applyStatus(ally, backupDancer);
        if (!tier) continue;
        for (const other of danceTiers) {
          if (other !== tier) ctx.removeStatus(ally, other);
        }
        ctx.applyStatus(ally, tier);
      }
    },
  });

  // Backup Dancer (with its A2 tier) reaches memosprites summoned while it
  // lasts, for the remaining duration.
  k.on(
    "summoned",
    "ultimate",
    { subject: "ally", when: (event) => event.unit.kind === "memosprite" },
    (ctx, event) => {
      for (const status of [backupDancer, ...danceTiers]) {
        const holder = ctx.allies.find(
          (ally) => ally !== event.unit && ally.has(status)
        );
        const turns = holder?.remainingTurns(status);
        if (turns) ctx.applyStatus(event.unit, status, { turns });
      }
    }
  );

  k.on("weaknessBreak", "talent", { subject: "ally" }, (ctx) =>
    ctx.gainEnergy(ctx.self, k.param("04", 1))
  );
  if (k.a(3)) {
    k.on("weaknessBreak", "a6", { subject: "ally" }, (ctx, event) => {
      if (isEnemy(event.target)) {
        ctx.delayAction(event.target, k.traceParam(3, 1));
      }
    });
  }
  if (k.e(2)) {
    k.on("battleStart", "e2", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, jailbreaking)
    );
  }
});
