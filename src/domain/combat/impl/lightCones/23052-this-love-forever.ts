import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/** This Love, Forever — Remembrance. SPD is applied from catalog properties. */
export default defineLightCone("23052", (k) => {
  // The memosprite holds Blank and Verse (no duration) until it
  // disappears; their auras follow its current state.
  const blank = k.status({
    id: "this-love-forever-blank",
    origin: "lightCone",
  });
  const verse = k.status({
    id: "this-love-forever-verse",
    origin: "lightCone",
  });
  // One stack is the base effect; holding both raises it to 1 + #4. Blank
  // is an aura of the memosprite rather than a debuff.
  const both = 1 + k.s(4);
  const blankAura = k.status({
    id: "this-love-forever-blank-aura",
    origin: "lightCone",
    unique: true,
    maxStacks: both,
    modifiers: [{ stat: "vulnerability", value: k.s(3) }],
  });
  const verseAura = k.status({
    id: "this-love-forever-verse-aura",
    origin: "lightCone",
    unique: true,
    maxStacks: both,
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });

  const syncStacks = (
    ctx: BattleApi,
    unit: UnitView,
    status: StatusDef,
    stacks: number
  ) => {
    if (stacks <= 0) {
      if (unit.has(status, ctx.self)) ctx.removeStatus(unit, status);
    } else if (!unit.has(status, ctx.self)) {
      ctx.applyStatus(unit, status, { setStacks: stacks });
    } else if (unit.stacks(status, ctx.self) !== stacks) {
      ctx.setStatusStacks(unit, status, stacks);
    }
  };
  const sync = (ctx: BattleApi) => {
    const memosprite = ctx.allies.find(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    );
    const hasBlank = memosprite?.has(blank) ?? false;
    const hasVerse = memosprite?.has(verse) ?? false;
    const scale = hasBlank && hasVerse ? both : 1;
    for (const enemy of ctx.enemies) {
      syncStacks(ctx, enemy, blankAura, hasBlank ? scale : 0);
    }
    for (const ally of ctx.allies) {
      syncStacks(ctx, ally, verseAura, hasVerse ? scale : 0);
    }
  };

  // "On one ally": a Memosprite Skill aimed at an ally (Demiurge's Ode);
  // "on an enemy": one aimed at enemies.
  k.on(
    "actionStart",
    "lightCone",
    { subject: "memosprite", abilityKinds: ["memospriteSkill"] },
    (ctx, event) => {
      const onAlly = event.target !== undefined && !isEnemy(event.target);
      ctx.applyStatus(event.unit, onAlly ? blank : verse);
      sync(ctx);
    }
  );
  for (const event of ["actionStart", "actionEnd", "turnEnd"] as const) {
    k.on(event, "lightCone", { subject: "any" }, sync);
  }
});
