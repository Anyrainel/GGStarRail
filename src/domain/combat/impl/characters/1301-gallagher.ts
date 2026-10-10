import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Gallagher — Abundance, Fire. */
export default defineCharacter("1301", (k) => {
  const besotted = k.status({
    id: "besotted",
    origin: "talent",
    debuff: true,
    duration: {
      turns: k.param("03", 2) + (k.e(4) ? k.rankParam(4, 1) : 0),
    },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("04", 1),
        filter: { tags: ["break"] },
      },
    ],
  });
  const nectarBlitz = k.status({ id: "nectar-blitz", origin: "ultimate" });
  const lionsTail = k.status({
    id: "lions-tail",
    origin: "e2",
    duration: { turns: k.rankParam(2, 3) },
    modifiers: [{ stat: "effectRes", value: k.rankParam(2, 2) }],
  });

  if (k.e(1)) {
    k.stat("e1", { stat: "effectRes", value: k.rankParam(1, 2) });
    k.on("battleStart", "e1", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(1, 1))
    );
  }
  if (k.e(6)) {
    k.stat("e6", { stat: "breakEffect", value: k.rankParam(6, 1) });
    k.stat("e6", { stat: "breakEfficiency", value: k.rankParam(6, 2) });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    usable: (view) => view.self.has(nectarBlitz),
    hits: [
      { shape: "single", main: k.param("08", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => ctx.removeStatus(ctx.self, nectarBlitz),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      if (k.e(2) && ctx.target && !isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, lionsTail);
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, besotted);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      ctx.applyStatus(ctx.self, nectarBlitz);
      // A4: "immediately advances action for this unit by 100%".
      if (k.a(2)) ctx.advanceAction(ctx.self, 1);
    },
  });

  // Healing is not simulated, so the Skill is never needed: Basic ATK, or
  // Nectar Blitz after an Ultimate.
  k.policy({
    turn: (view) => (view.self.has(nectarBlitz) ? "enhancedBasic" : "basic"),
  });
});
