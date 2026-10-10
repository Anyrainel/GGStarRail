import { isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Colors for Tomorrow — Elation. DEF is applied from catalog properties. */
export default defineLightCone("23055", (k) => {
  const inkSplash = k.status({
    id: "colors-for-tomorrow-ink-splash",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "vulnerability", value: k.s(4) }],
  });

  // Elation Skills carry no ally target: one is "on all allies" when it does
  // not attack enemies and the statuses the wearer applies during it reach
  // every ally Character. Healing is not modeled.
  let recipients: Set<UnitView> | null = null;
  const elationSkill = { abilityKinds: ["elationSkill"] } as const;
  k.on("actionStart", "lightCone", elationSkill, () => {
    recipients = new Set();
  });
  k.on("statusApplied", "lightCone", {}, (_ctx, event) => {
    if (recipients && event.target && !isEnemy(event.target)) {
      recipients.add(event.target);
    }
  });
  k.on("actionEnd", "lightCone", elationSkill, (ctx, event) => {
    const reached = recipients;
    recipients = null;
    if (event.attack || !reached) return;
    const allies = ctx.allies.filter((ally) => ally.kind === "character");
    if (!allies.every((ally) => reached.has(ally))) return;
    for (const enemy of ctx.enemies) ctx.applyStatus(enemy, inkSplash);
    ctx.gainEnergy(ctx.self, k.s(2), { fixed: true });
  });
});
