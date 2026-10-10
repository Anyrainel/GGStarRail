import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

const ABYSS_FLOWER = "abyss-flower";
const AUTO_SKILL_COOLDOWN = "auto-skill-cooldown";

/** Luocha — Abundance, Imaginary. */
export default defineCharacter("1203", (k) => {
  const zoneTurns = k.param("04", 3);
  // The Zone heals only; it is tracked for E1. It lasts Luocha's turns.
  const zone = k.status({
    id: "zone",
    origin: "talent",
    duration: { turns: zoneTurns },
  });
  const ablution = k.status({
    id: "ablution-of-the-quick",
    origin: "e1",
    duration: { turns: zoneTurns, clock: "applier" },
    modifiers: [{ stat: "atkPct", value: k.rankParam(1, 1) }],
  });
  const reunion = k.status({
    id: "reunion-with-the-dust",
    origin: "e6",
    debuff: true,
    duration: { turns: k.rankParam(6, 3) },
    modifiers: [{ stat: "resReduction", value: k.rankParam(6, 2) }],
  });

  const gainAbyssFlower = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, ABYSS_FLOWER, 1);
    if (ctx.self.counter(ABYSS_FLOWER) < k.param("04", 1) - 1e-9) return;
    ctx.setCounter(ctx.self, ABYSS_FLOWER, 0);
    ctx.applyStatus(ctx.self, zone);
    if (k.e(1)) {
      for (const ally of ctx.allies) ctx.applyStatus(ally, ablution);
    }
  };

  // The Skill also triggers by itself when an ally drops to 50% HP or lower.
  // HP is not simulated: when enabled, each enemy attack off cooldown counts.
  const autoSkill = k.toggle(
    "auto-skill",
    "skill",
    "selfHpBelow",
    false,
    k.param("02", 3)
  );
  if (autoSkill) {
    k.on(
      "enemyAttack",
      "skill",
      {
        subject: "enemy",
        when: (_event, self) => self.counter(AUTO_SKILL_COOLDOWN) <= 1e-9,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, AUTO_SKILL_COOLDOWN, k.param("02", 4));
        gainAbyssFlower(ctx);
      }
    );
    k.on("turnEnd", "skill", {}, (ctx) =>
      ctx.setCounter(
        ctx.self,
        AUTO_SKILL_COOLDOWN,
        Math.max(0, ctx.self.counter(AUTO_SKILL_COOLDOWN) - 1)
      )
    );
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
    target: "ally",
    after: gainAbyssFlower,
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (!k.e(6)) return;
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, reunion);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: gainAbyssFlower,
  });

  // Basic ATK keeps Skill Points for the team. At E1 the Skill completes a
  // missing Zone for its ATK bonus.
  k.policy({
    turn: (view) =>
      k.e(1) &&
      !view.self.has(zone) &&
      view.self.counter(ABYSS_FLOWER) >= k.param("04", 1) - 1 - 1e-9
        ? "skill"
        : "basic",
  });
});
