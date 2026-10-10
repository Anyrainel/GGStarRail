import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * I Shall Be My Own Sword — Destruction. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23014", (k) => {
  const maxStacks = k.s(2);

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
  // Teammates' consumed HP, one stack per teammate and occurrence: Jingliu's
  // Spectral Transmigration attacks, Castorice's Skills, their own costs.
  k.on(
    "hpChanged",
    "lightCone",
    {
      subject: "otherAlly",
      when: (event) => event.hpCause === "consume" && (event.delta ?? 0) < 0,
    },
    (ctx) => gain(ctx, ctx.weight)
  );
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) => {
    ctx.removeStatus(ctx.self, eclipse);
    ctx.removeStatus(ctx.self, eclipseFull);
  });
});
