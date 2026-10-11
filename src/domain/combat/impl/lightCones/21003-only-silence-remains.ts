import { defineLightCone } from "../../kit/equipment";

/** Only Silence Remains — The Hunt. ATK is applied from catalog properties. */
export default defineLightCone("21003", (k) => {
  const record = k.status({
    id: "record",
    origin: "lightCone",
    modifiers: [{ stat: "critRate", value: k.s(2) }],
  });
  // "2 or fewer enemies" has no placeholder. Kills are not simulated, so the
  // enemy count at battle start holds for the whole battle.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    if (ctx.enemies.length <= 2) ctx.applyStatus(ctx.self, record);
  });
});
