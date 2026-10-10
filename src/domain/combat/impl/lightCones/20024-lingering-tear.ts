import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Lingering Tear — Elation. */
export default defineLightCone("20024", (k) => {
  const mourning = k.status({
    id: "lingering-tear-mourning",
    origin: "lightCone",
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  const sync = (ctx: BattleApi) => {
    if (ctx.teamResource("punchline") + 1e-9 >= k.s(1)) {
      if (!ctx.self.has(mourning)) ctx.applyStatus(ctx.self, mourning);
    } else {
      ctx.removeStatus(ctx.self, mourning);
    }
  };
  k.on("battleStart", "lightCone", { subject: "any" }, sync);
  k.on(
    "teamResourceChanged",
    "lightCone",
    { subject: "any", resource: "punchline" },
    sync
  );
  // The Aha Instant clears Punchline without a resource event.
  k.on("ahaInstantEnd", "lightCone", { subject: "any" }, sync);
});
