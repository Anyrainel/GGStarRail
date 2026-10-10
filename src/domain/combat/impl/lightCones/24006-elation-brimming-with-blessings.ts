import { isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Elation Brimming With Blessings — Elation. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("24006", (k) => {
  const opening = k.status({
    id: "elation-brimming-with-blessings-opening",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "elation", value: k.s(2) }],
  });
  const isAllyCharacter = (unit: UnitView | undefined): unit is UnitView =>
    unit !== undefined && !isEnemy(unit) && unit.kind === "character";

  // An ally target is known only when the turn policy names one. Otherwise
  // a Skill or Ultimate that does not attack enemies is "on one ally
  // character" when the statuses the wearer applies during it reach exactly
  // one other Character (as A Grounded Ascent).
  let recipients: Set<UnitView> | null = null;
  const abilities = { abilityKinds: ["skill", "ultimate"] } as const;
  k.on("actionStart", "lightCone", abilities, () => {
    recipients = new Set();
  });
  k.on("statusApplied", "lightCone", {}, (ctx, event) => {
    if (
      recipients &&
      isAllyCharacter(event.target) &&
      event.target !== ctx.self
    ) {
      recipients.add(event.target);
    }
  });
  k.on("actionEnd", "lightCone", abilities, (ctx, event) => {
    const reached = recipients ? [...recipients] : [];
    recipients = null;
    const target = isAllyCharacter(event.target)
      ? event.target
      : !event.attack && reached.length === 1
        ? reached[0]
        : undefined;
    if (target) ctx.applyStatus(target, opening);
  });
});
