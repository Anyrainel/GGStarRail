import type { BattleApi, UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Summons as opposed to countdowns (Concerto and other '-countdown'
 * Action Order entries), as in Sunday's kit. The Bondmate's Souldragon is
 * not seen (it needs Dan Heng • Permansor Terrae's Bondmate state).
 */
const SUMMON_IDS = ["lightning-lord", "numby", "fuyuan", "souldragon"];

/** Though Worlds Apart — Preservation. ATK is applied from catalog properties. */
export default defineLightCone("23051", (k) => {
  const redoubt = k.status({
    id: "redoubt",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  // Held while the holder has Redoubt and an active memosprite or summon.
  const redoubtSummoner = k.status({
    id: "redoubt-summoner",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  const hasSummon = (ctx: BattleApi, owner: UnitView) =>
    ctx.allies.some(
      (unit) => unit.kind === "memosprite" && unit.owner === owner
    ) || SUMMON_IDS.some((id) => ctx.findSummon(owner, id) !== null);
  const sync = (ctx: BattleApi) => {
    for (const ally of ctx.allies) {
      const wanted = ally.has(redoubt, ctx.self) && hasSummon(ctx, ally);
      const held = ally.has(redoubtSummoner, ctx.self);
      if (wanted && !held) ctx.applyStatus(ally, redoubtSummoner);
      else if (!wanted && held) ctx.removeStatus(ally, redoubtSummoner);
    }
  };

  const healAll = k.s(5);
  const healLowest = k.s(6);
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    const amount =
      ctx.self.currentStat("atk") *
      (1 + ctx.self.currentStat("outgoingHealing"));
    // "The character with the lowest current HP": current HP, not its share
    // of Max HP, as the state was when the Ultimate was used.
    let lowest: UnitView | null = null;
    let lowestHp = Number.POSITIVE_INFINITY;
    for (const ally of ctx.allies) {
      if (ally.kind !== "character") continue;
      const hp = ally.hpRatio * ally.currentStat("hp");
      if (hp < lowestHp - 1e-9) {
        lowest = ally;
        lowestHp = hp;
      }
    }
    for (const ally of ctx.allies) {
      const maxHp = ally.currentStat("hp");
      if (maxHp > 0) ctx.heal(ally, (healAll * amount) / maxHp);
    }
    const lowestMaxHp = lowest?.currentStat("hp") ?? 0;
    if (lowest && lowestMaxHp > 0) {
      ctx.heal(lowest, (healLowest * amount) / lowestMaxHp);
    }
    for (const ally of ctx.allies) ctx.applyStatus(ally, redoubt);
    sync(ctx);
  });
  k.on("statusRemoved", "lightCone", { status: redoubt }, sync);
  k.on("summoned", "lightCone", { subject: "ally" }, sync);
  k.on("departed", "lightCone", { subject: "ally" }, sync);
});
