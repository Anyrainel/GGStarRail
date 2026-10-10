import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Ally targets: Characters and memosprites, not countdowns or summons. */
const isAllyTarget = (unit: UnitView) =>
  unit.kind === "character" || unit.kind === "memosprite";

/** Huohuo — Abundance, Wind. */
export default defineCharacter("1217", (k) => {
  const provisionTurns = k.param("04", 1) + (k.e(1) ? k.rankParam(1, 2) : 0);
  const divineProvision = k.status({
    id: "divine-provision",
    origin: "talent",
    // "This duration decreases by 1 turn at the start of Huohuo's every turn."
    duration: { turns: provisionTurns, countdown: "turnStart" },
  });
  // E1 lasts exactly as long as Divine Provision: same clock, same turns.
  const anchoredToVessel = k.status({
    id: "anchored-to-vessel",
    origin: "e1",
    duration: {
      turns: provisionTurns,
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
  });
  const spiritualDomination = k.status({
    id: "spiritual-domination",
    origin: "ultimate",
    duration: { turns: k.param("03", 3) },
    modifiers: [{ stat: "atkPct", value: k.param("03", 2) }],
  });
  const wovenTogether = k.status({
    id: "woven-together",
    origin: "e6",
    duration: { turns: k.rankParam(6, 2) },
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 1) }],
  });

  const gainProvision = (ctx: BattleApi, turns: number) => {
    ctx.applyStatus(ctx.self, divineProvision, { turns });
    if (!k.e(1)) return;
    for (const ally of ctx.allies) {
      ctx.applyStatus(ally, anchoredToVessel, { turns });
    }
  };

  const healed = (ctx: BattleApi, ally: UnitView) => {
    if (k.e(6)) ctx.applyStatus(ally, wovenTogether);
  };

  // Divine Provision heals the ally whose turn starts or who uses an
  // Ultimate. Its extra heals for allies at 50% HP or lower add no trigger
  // count and no E6 uptime beyond these.
  const talentHeal = (ctx: BattleApi, ally: UnitView) => {
    if (k.a(3)) ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
    healed(ctx, ally);
  };
  const providing = (unit: UnitView, self: UnitView) =>
    isAllyTarget(unit) && self.has(divineProvision);
  k.on(
    "turnStart",
    "talent",
    { subject: "ally", when: (event, self) => providing(event.unit, self) },
    (ctx, event) => talentHeal(ctx, event.unit)
  );
  k.on(
    "actionStart",
    "talent",
    {
      subject: "ally",
      abilityKinds: ["ultimate"],
      when: (event, self) => providing(event.unit, self),
    },
    (ctx, event) => talentHeal(ctx, event.unit)
  );

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      gainProvision(ctx, k.traceParam(1, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      healed(ctx, target);
      for (const ally of ctx.allies) {
        if (
          ally.kind === "character" &&
          Math.abs(ally.slot - target.slot) === 1
        ) {
          healed(ctx, ally);
        }
      }
      gainProvision(ctx, provisionTurns);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) {
        if (ally === ctx.self) continue;
        // Memosprites have no Energy of their own.
        if (ally.kind === "character") {
          ctx.gainEnergy(ally, ally.maxEnergy * k.param("03", 1));
        }
        ctx.applyStatus(ally, spiritualDomination);
      }
    },
  });

  /** The Character whose Skill heal also reaches the most adjacent allies. */
  const skillTarget = (view: PolicyView): UnitView => {
    const characters = view.allies.filter((ally) => ally.kind === "character");
    const reach = (unit: UnitView) =>
      characters.filter((ally) => Math.abs(ally.slot - unit.slot) <= 1).length;
    return characters.reduce(
      (best, ally) => (reach(ally) > reach(best) ? ally : best),
      characters[0] ?? view.self
    );
  };

  // Skill only when Divine Provision has run out; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.self.has(divineProvision)
        ? "basic"
        : { ability: "skill", target: skillTarget(view) },
  });
});
