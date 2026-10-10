import { type BattleApi, isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** When She Decided to See — Elation. SPD is applied from catalog properties. */
export default defineLightCone("23054", (k) => {
  const greatFortune = k.status({
    id: "when-she-decided-to-see-great-fortune",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "energyRegen", value: k.s(5) }],
  });
  // The team bonus lasts while the wearer holds Great Fortune, so every
  // ally's copy counts down on the wearer's turns.
  const greatFortuneTeam = k.status({
    id: "when-she-decided-to-see-great-fortune-team",
    origin: "lightCone",
    duration: { turns: k.s(4), clock: "applier" },
    modifiers: [
      { stat: "critRate", value: k.s(2) },
      { stat: "critDmg", value: k.s(3) },
    ],
  });
  const gainGreatFortune = (ctx: BattleApi) => {
    ctx.applyStatus(ctx.self, greatFortune);
    for (const ally of ctx.allies) ctx.applyStatus(ally, greatFortuneTeam);
  };

  // The battle is a single wave.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    gainGreatFortune(ctx);
    ctx.gainEnergy(ctx.self, k.s(6), { fixed: true });
  });
  // Ultimates carry an ally target only when the policy names one; an
  // Ultimate that does not attack enemies is read as aimed at allies.
  k.on(
    "actionStart",
    "lightCone",
    {
      abilityKinds: ["ultimate"],
      when: (event) =>
        (event.target !== undefined && !isEnemy(event.target)) || !event.attack,
    },
    gainGreatFortune
  );
});
