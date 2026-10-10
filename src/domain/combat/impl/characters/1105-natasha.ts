import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Natasha — Abundance, Physical. */
export default defineCharacter("1105", (k) => {
  if (k.a(2)) {
    k.stat("a4", { stat: "outgoingHealing", value: k.traceParam(2, 1) });
  }

  // E6: "additionally deals Physical DMG equal to X% of her Max HP", taken
  // as a second scaling part of the Basic ATK's instance.
  const e6Rider: HitDef[] = k.e(6)
    ? [{ shape: "single", main: k.rankParam(6, 1), stat: "hp", silent: true }]
    : [];

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
      ...e6Rider,
    ],
  });

  // Healing is not modelled; the Skill and Ultimate keep their Energy and
  // Skill Point effects.
  k.ability({ id: "skill", kind: "skill", target: "ally" });
  k.ability({ id: "ultimate", kind: "ultimate", target: "allies" });

  if (k.e(4)) {
    k.on("hitByEnemy", "e4", { subject: "self" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }

  // HP is not simulated, so healing is never urgent: Basic ATK, with a Skill
  // only when a Basic ATK would overflow the Skill Point cap.
  k.policy({
    turn: (view) =>
      view.skillPoints >= view.maxSkillPoints ? "skill" : "basic",
  });
});
