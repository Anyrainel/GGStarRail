import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * She Already Shut Her Eyes — Preservation. Max HP and Energy Regeneration
 * Rate are applied from catalog properties. The wave-start heal does nothing
 * in a single wave that starts at full HP.
 */
export default defineLightCone("23011", (k) => {
  const visioscape = k.status({
    id: "visioscape",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const buffAllies = (ctx: BattleApi) => {
    for (const ally of ctx.allies) {
      ctx.applyStatus(ally, visioscape, { stacks: ctx.weight });
    }
  };
  // Enemy hits reduce the wearer's HP with its aggro share, held as expected
  // stacks. Fu Xuan's Matrix of Prescience moves part of every ally's DMG
  // taken to her, so hits on any ally reduce it.
  const sharesAllyDmg = k.wearer.characterId === "1208";
  k.on(
    "hitByEnemy",
    "lightCone",
    { subject: sharesAllyDmg ? "ally" : "self" },
    buffAllies
  );
  // HP consumed from the wearer (Castorice's Skills, Jingliu's Spectral
  // Transmigration attacks, Long May Rainbows Adorn the Sky).
  k.on(
    "hpChanged",
    "lightCone",
    {
      when: (event) => event.hpCause === "consume" && (event.delta ?? 0) < 0,
    },
    buffAllies
  );
});
