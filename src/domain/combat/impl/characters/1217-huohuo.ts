import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;

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

  /**
   * Restores `ratio` of Huohuo's Max HP plus `flat` (every heal comes from
   * the Skill or Talent). E4's bonus grows linearly with the HP the target
   * is missing, reaching its maximum at 0 HP (assumed shape). E6 buffs the
   * healed ally.
   */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const e4 = k.e(4) ? k.rankParam(4, 1) * (1 - target.hpRatio) : 0;
    const amount = ratio * ctx.self.panelStat("hp") + flat;
    const boost = 1 + ctx.self.panelStat("outgoingHealing") + e4;
    ctx.heal(target, (amount * boost) / maxHp);
    if (k.e(6)) ctx.applyStatus(target, wovenTogether);
  };

  // Divine Provision heals the ally whose turn starts or who uses an
  // Ultimate and, at the same time, once each ally at 50% HP or lower (read
  // when it triggers, so a low triggering ally is healed twice).
  const talentHeal = (ctx: BattleApi, ally: UnitView) => {
    if (k.a(3)) ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
    const low = ctx.allies.filter(
      (unit) => isAllyTarget(unit) && unit.hpRatio <= k.param("04", 6) + 1e-9
    );
    heal(ctx, ally, k.param("04", 3), k.param("04", 5));
    for (const unit of low) heal(ctx, unit, k.param("04", 3), k.param("04", 5));
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
      heal(ctx, target, k.param("02", 1), k.param("02", 2));
      for (const ally of ctx.allies) {
        if (
          ally.kind === "character" &&
          Math.abs(ally.slot - target.slot) === 1
        ) {
          heal(ctx, ally, k.param("02", 3), k.param("02", 4));
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
        // A fixed share of each teammate's max Energy, unaffected by ERR.
        // Memosprites have no Energy of their own.
        if (ally.kind === "character") {
          ctx.gainEnergy(ally, ally.maxEnergy * k.param("03", 1), {
            fixed: true,
          });
        }
        ctx.applyStatus(ally, spiritualDomination);
      }
    },
  });

  /**
   * The ally Character with the lowest HP share; ties go to the one whose
   * Skill heal also reaches the most adjacent allies.
   */
  const skillTarget = (view: PolicyView): UnitView => {
    const characters = view.allies.filter((ally) => ally.kind === "character");
    const reach = (unit: UnitView) =>
      characters.filter((ally) => Math.abs(ally.slot - unit.slot) <= 1).length;
    return characters.reduce((best, ally) => {
      if (Math.abs(ally.hpRatio - best.hpRatio) > 1e-9) {
        return ally.hpRatio < best.hpRatio ? ally : best;
      }
      return reach(ally) > reach(best) ? ally : best;
    }, characters[0] ?? view.self);
  };

  // Skill when Divine Provision has run out or an ally Character is low;
  // Basic ATK otherwise.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const target = skillTarget(view);
      return !view.self.has(divineProvision) || target.hpRatio <= LOW_HP + 1e-9
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
