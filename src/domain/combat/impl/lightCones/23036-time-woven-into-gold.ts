import type { BattleApi, UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { ModifierDef, StatusDef } from "../../kit/model";

/** Time Woven Into Gold — Remembrance. Base SPD is applied from catalog properties. */
export default defineLightCone("23036", (k) => {
  const maxStacks = k.s(2);
  const critDmg: ModifierDef = { stat: "critDmg", value: k.s(4) };
  const brocade = k.status({
    id: "time-woven-into-gold-brocade",
    origin: "lightCone",
    maxStacks,
    modifiers: [critDmg],
  });
  const brocadeMemosprite = k.status({
    id: "time-woven-into-gold-brocade-memosprite",
    origin: "lightCone",
    maxStacks,
    modifiers: [critDmg],
  });
  // At maximum stacks, every stack adds Basic ATK DMG (Brocade's holders:
  // the wearer and their memosprite).
  const fullModifiers: ModifierDef[] = [
    { stat: "dmgBoost", value: k.s(3), filter: { tags: ["basic"] } },
  ];
  const full = k.status({
    id: "time-woven-into-gold-full",
    origin: "lightCone",
    maxStacks,
    modifiers: fullModifiers,
  });
  const fullMemosprite = k.status({
    id: "time-woven-into-gold-full-memosprite",
    origin: "lightCone",
    maxStacks,
    modifiers: fullModifiers,
  });

  const syncStacks = (
    ctx: BattleApi,
    unit: UnitView,
    status: StatusDef,
    stacks: number
  ) => {
    if (stacks <= 1e-9) {
      if (unit.has(status)) ctx.removeStatus(unit, status);
    } else if (!unit.has(status)) {
      ctx.applyStatus(unit, status, { setStacks: stacks });
    } else if (Math.abs(unit.stacks(status) - stacks) > 1e-9) {
      ctx.setStatusStacks(unit, status, stacks);
    }
  };
  // The wearer holds Brocade; its memosprite (summoned later included)
  // mirrors the stacks.
  const sync = (ctx: BattleApi) => {
    const stacks = ctx.self.stacks(brocade);
    const fullStacks = stacks + 1e-9 >= maxStacks ? stacks : 0;
    syncStacks(ctx, ctx.self, full, fullStacks);
    for (const unit of ctx.allies) {
      if (unit.kind !== "memosprite" || unit.owner !== ctx.self) continue;
      syncStacks(ctx, unit, brocadeMemosprite, stacks);
      syncStacks(ctx, unit, fullMemosprite, fullStacks);
    }
  };
  k.on(
    "actionEnd",
    "lightCone",
    {
      subject: "selfOrMemosprite",
      attack: true,
      when: (event) => event.unit.kind !== "summon",
    },
    (ctx) => {
      ctx.applyStatus(ctx.self, brocade, { stacks: ctx.weight });
      sync(ctx);
    }
  );
  k.on("actionStart", "lightCone", { subject: "any" }, sync);
});
