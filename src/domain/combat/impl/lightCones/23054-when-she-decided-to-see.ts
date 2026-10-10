import type { BattleApi } from "../../kit/api";
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

  // An aura of Great Fortune: a memosprite summoned while it lasts joins it,
  // and every copy ends with it.
  k.on("statusRemoved", "lightCone", { status: greatFortune }, (ctx) => {
    for (const ally of ctx.allies) {
      if (ally.has(greatFortuneTeam, ctx.self)) {
        ctx.removeStatus(ally, greatFortuneTeam);
      }
    }
  });
  k.on(
    "summoned",
    "lightCone",
    {
      subject: "ally",
      when: (event, self) =>
        event.unit.kind === "memosprite" && self.has(greatFortune),
    },
    (ctx, event) => {
      const turns = ctx.self.remainingTurns(greatFortune);
      if (turns) ctx.applyStatus(event.unit, greatFortuneTeam, { turns });
    }
  );

  // The battle is a single wave.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    gainGreatFortune(ctx);
    ctx.gainEnergy(ctx.self, k.s(6), { fixed: true });
  });
  // "On an ally target" (对我方目标): an Ultimate aimed at one ally, all
  // allies, or the wearer.
  k.on(
    "actionStart",
    "lightCone",
    {
      abilityKinds: ["ultimate"],
      when: (event) =>
        event.abilityTarget === "ally" ||
        event.abilityTarget === "allies" ||
        event.abilityTarget === "self",
    },
    gainGreatFortune
  );
});
