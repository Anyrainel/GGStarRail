import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Sushang — The Hunt, Physical. */
export default defineCharacter("1206", (k) => {
  const dawnHerald = k.status({
    id: "dawn-herald",
    origin: "ultimate",
    duration: { turns: k.param("03", 2) },
    modifiers: [{ stat: "atkPct", value: k.param("03", 4) }],
  });
  // "Sword Stance triggered from the extra chances deals #3 of the original
  // DMG": applied around those procs only.
  const extraSwordStance = k.status({
    id: "sword-stance-extra",
    origin: "ultimate",
    modifiers: [
      {
        stat: "dmgMultiplier",
        value: k.param("03", 3) - 1,
        filter: { tags: ["additional"] },
      },
    ],
  });
  // Sword Stance is Sushang's only Additional DMG.
  const riposte = k.status({
    id: "riposte",
    origin: "a4",
    maxStacks: k.traceParam(2, 2),
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(2, 1),
        filter: { tags: ["additional"] },
      },
    ],
  });
  const dancingBlade = k.status({
    id: "dancing-blade",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    // E6: "stackable and can stack up to 2 times".
    maxStacks: k.e(6) ? 2 : 1,
    modifiers: [{ stat: "spdPct", value: k.param("04", 1) }],
  });

  if (k.e(4)) k.stat("e4", { stat: "breakEffect", value: k.rankParam(4, 1) });

  // A fixed-chance proc: its expected share scales the multiplier and the
  // Riposte stacks it grants.
  const swordStance = (
    ctx: BattleApi,
    target: EnemyView,
    chance: number,
    origin: "skill" | "ultimate"
  ) => {
    ctx.deal(
      {
        shape: "single",
        main: k.param("02", 2) * chance,
        onlyTags: ["additional"],
      },
      { targets: [target], origin }
    );
    if (k.a(2)) ctx.applyStatus(ctx.self, riposte, { stacks: chance });
  };

  const vanquisher = (ctx: BattleApi) => {
    if (k.a(3) && ctx.enemies.some((enemy) => enemy.broken)) {
      ctx.advanceAction(ctx.self, k.traceParam(3, 1));
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: vanquisher,
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      const target = ctx.target;
      if (isEnemy(target)) {
        const chance = target.broken ? 1 : k.param("02", 3);
        swordStance(ctx, target, chance, "skill");
        if (ctx.self.has(dawnHerald)) {
          // "2 extra chances" (no parameter in the text).
          ctx.applyStatus(ctx.self, extraSwordStance);
          for (let extra = 0; extra < 2; extra += 1) {
            swordStance(ctx, target, chance, "ultimate");
          }
          ctx.removeStatus(ctx.self, extraSwordStance);
        }
        // E1: "regenerates 1 Skill Point" (no parameter in the text).
        if (k.e(1) && target.broken) ctx.gainSkillPoints(1);
      }
      vanquisher(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      ctx.applyStatus(ctx.self, dawnHerald);
      ctx.advanceAction(ctx.self, 1);
    },
  });

  k.on("weaknessBreak", "talent", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, dancingBlade)
  );
  if (k.e(6)) {
    k.on("battleStart", "e6", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, dancingBlade)
    );
  }
});
