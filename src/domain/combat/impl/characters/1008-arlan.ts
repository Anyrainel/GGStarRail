import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Arlan — Destruction, Lightning. */
export default defineCharacter("1008", (k) => {
  // HP is not simulated. Arlan is played without healing, so his HP is
  // tracked from full at battle start and only his Skill changes it (down to
  // 1 HP); enemy DMG and healing are not modeled.
  const lowHp = 0.5; // E1/E6: "50%" (no placeholder)

  // Missing HP fraction as stacks: "up to a maximum of 72%" at 0 HP left.
  const painAndAnger = k.status({
    id: "pain-and-anger",
    origin: "talent",
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 1) }],
  });

  const e1 = k.e(1)
    ? k.status({
        id: "e1-skill-dmg",
        origin: "e1",
        modifiers: [
          {
            stat: "dmgBoost",
            value: k.rankParam(1, 1),
            filter: { tags: ["skill"] },
          },
        ],
      })
    : null;
  const e6 = k.e(6)
    ? k.status({
        id: "e6-ultimate-dmg",
        origin: "e6",
        modifiers: [
          {
            stat: "dmgBoost",
            value: k.rankParam(6, 1),
            filter: { tags: ["ultimate"] },
          },
        ],
      })
    : null;

  const consumeHp = (ctx: BattleApi, fraction: number) => {
    const missing = Math.min(1, ctx.self.counter("hp-missing") + fraction);
    ctx.setCounter(ctx.self, "hp-missing", missing);
    ctx.applyStatus(ctx.self, painAndAnger, { setStacks: missing });
    if (missing >= 1 - lowHp - 1e-9) {
      if (e1) ctx.applyStatus(ctx.self, e1);
      if (e6) ctx.applyStatus(ctx.self, e6);
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Facts: the Skill costs HP instead of Skill Points.
  k.ability({
    id: "skill",
    kind: "skill",
    skillPoints: 0,
    before: (ctx) => consumeHp(ctx, k.param("02", 1)),
    hits: [
      { shape: "single", main: k.param("02", 2), toughness: { main: 20 } },
    ],
  });

  const ultHit: HitDef = {
    shape: "blast",
    main: k.param("03", 1),
    adjacent: k.param("03", 2),
    toughness: { main: 20, adjacent: 20 },
  };
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      // E6 at 50% HP or lower: adjacent multiplier raised to the main one.
      ultHit.adjacent =
        e6 && ctx.self.has(e6) ? k.param("03", 1) : k.param("03", 2);
    },
    hits: [ultHit],
  });

  // The Skill costs no Skill Points, so it is used every turn.
  k.policy({ turn: () => "skill" });
});
