import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * I Shall Be My Own Sword — Destruction. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23014", (k) => {
  const maxStacks = k.s(2);
  // HP is not simulated. Teammates' HP loss is assumed at the start of each
  // of the wearer's attacks, one stack per teammate; it defaults on for
  // Jingliu, whose Spectral Transmigration attacks consume teammates' HP
  // (her Skills outside it do not).
  const teammateHpLoss = k.toggle(
    "teammate-hp-loss",
    "lightCone",
    "active",
    k.wearer.characterId === "1212"
  );

  const eclipse = k.status({
    id: "eclipse",
    origin: "lightCone",
    maxStacks,
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  const eclipseFull = k.status({
    id: "eclipse-full",
    origin: "lightCone",
    modifiers: [{ stat: "defIgnore", value: k.s(4) }],
  });

  const gain = (ctx: BattleApi, n: number) => {
    ctx.applyStatus(ctx.self, eclipse, { stacks: n });
    if (ctx.self.stacks(eclipse) >= maxStacks - 1e-9) {
      ctx.applyStatus(ctx.self, eclipseFull);
    }
  };

  // Enemy attacks hit teammates with their aggro share, so stacks build up in
  // expectation; the DEF ignore needs the full expected count.
  k.on("hitByEnemy", "lightCone", { subject: "otherAlly" }, (ctx) =>
    gain(ctx, ctx.weight)
  );
  if (teammateHpLoss) {
    k.on("actionStart", "lightCone", { attack: true }, (ctx) => {
      const teammates = ctx.allies.filter(
        (ally) => ally !== ctx.self && ally.kind === "character"
      ).length;
      if (teammates > 0) gain(ctx, teammates);
    });
  }
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) => {
    ctx.removeStatus(ctx.self, eclipse);
    ctx.removeStatus(ctx.self, eclipseFull);
  });
});
