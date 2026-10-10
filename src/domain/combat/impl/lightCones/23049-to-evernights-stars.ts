import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** To Evernight's Stars — Remembrance. Max HP is applied from catalog properties. */
export default defineLightCone("23049", (k) => {
  // Noctis has no duration. EN puts the DMG increase and the Energy in
  // separate sentences; ZH places every effect under "while the wearer has
  // Noctis", which is followed. Its effects are mirrored onto memosprites,
  // summoned later included.
  const noctis = k.status({
    id: "to-evernights-stars-noctis",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  const noctisMemosprite = k.status({
    id: "to-evernights-stars-noctis-memosprite",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  // "Effects of the same type cannot stack": one DEF ignore per memosprite.
  const allMemosprites = k.status({
    id: "to-evernights-stars-def-ignore",
    origin: "lightCone",
    unique: true,
    modifiers: [{ stat: "defIgnore", value: k.s(2) }],
  });

  const sync = (ctx: BattleApi) => {
    if (!ctx.self.has(noctis)) return;
    for (const unit of ctx.allies) {
      if (unit.kind !== "memosprite") continue;
      if (!unit.has(allMemosprites, ctx.self)) {
        ctx.applyStatus(unit, allMemosprites);
      }
      if (unit.owner === ctx.self && !unit.has(noctisMemosprite)) {
        ctx.applyStatus(unit, noctisMemosprite);
      }
    }
  };
  k.on("actionStart", "lightCone", { subject: "memosprite" }, (ctx) => {
    if (!ctx.self.has(noctis)) ctx.applyStatus(ctx.self, noctis);
    sync(ctx);
  });
  k.on("actionStart", "lightCone", { subject: "any" }, sync);

  // "When the memosprite disappears" is checked at turn and action
  // boundaries (there is no dismissal event).
  const PRESENT = "lc23049:present";
  const checkDeparture = (ctx: BattleApi) => {
    const present = ctx.allies.some(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    )
      ? 1
      : 0;
    const was = ctx.self.counter(PRESENT);
    ctx.setCounter(ctx.self, PRESENT, present);
    if (was === 1 && present === 0 && ctx.self.has(noctis)) {
      ctx.gainEnergy(ctx.self, k.s(4));
    }
  };
  for (const event of [
    "turnStart",
    "turnEnd",
    "actionStart",
    "actionEnd",
  ] as const) {
    k.on(event, "lightCone", { subject: "any" }, checkDeparture);
  }
});
