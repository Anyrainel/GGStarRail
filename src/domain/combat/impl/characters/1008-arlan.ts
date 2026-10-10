import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";

/** Arlan — Destruction, Lightning. */
export default defineCharacter("1008", (k) => {
  const lowHp = 0.5; // E1/E6: "50%" (no placeholder)

  // Missing HP fraction as stacks: "up to a maximum of 72%" at 0 HP left
  // (linear, per the ability config).
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

  const toggle = (ctx: BattleApi, status: StatusDef | null, on: boolean) => {
    if (!status) return;
    if (on) ctx.applyStatus(ctx.self, status);
    else ctx.removeStatus(ctx.self, status);
  };
  /** Talent, E1, and E6 follow his HP: enemy DMG, the Skill, and heals. */
  const syncHp = (ctx: BattleApi) => {
    const missing = 1 - ctx.self.hpRatio;
    if (ctx.self.has(painAndAnger)) {
      ctx.setStatusStacks(ctx.self, painAndAnger, missing);
    } else if (missing > 0) {
      ctx.applyStatus(ctx.self, painAndAnger, { setStacks: missing });
    }
    const low = ctx.self.hpRatio <= lowHp + 1e-9;
    toggle(ctx, e1, low);
    toggle(ctx, e6, low);
  };
  k.on("battleStart", "talent", { subject: "any" }, syncHp);
  k.on("hpChanged", "talent", {}, syncHp);

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
    before: (ctx) => {
      ctx.consumeHp(ctx.self, k.param("02", 1));
    },
    hits: [
      { shape: "single", main: k.param("02", 2), toughness: { main: 20 } },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // E6 at 50% HP or lower: adjacent multiplier raised to the main one.
    hits: (ctx) => [
      {
        shape: "blast",
        main: k.param("03", 1),
        adjacent: e6 && ctx.self.has(e6) ? k.param("03", 1) : k.param("03", 2),
        toughness: { main: 20, adjacent: 20 },
      },
    ],
  });

  // The Skill costs no Skill Points, so it is used every turn.
  k.policy({ turn: () => "skill" });
});
