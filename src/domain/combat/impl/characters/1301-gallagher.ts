import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;

/** Gallagher — Abundance, Fire. */
export default defineCharacter("1301", (k) => {
  const besotted = k.status({
    id: "besotted",
    origin: "talent",
    debuff: true,
    duration: {
      turns: k.param("03", 2) + (k.e(4) ? k.rankParam(4, 1) : 0),
    },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("04", 1),
        filter: { tags: ["break"] },
      },
    ],
  });
  const nectarBlitz = k.status({ id: "nectar-blitz", origin: "ultimate" });
  const lionsTail = k.status({
    id: "lions-tail",
    origin: "e2",
    duration: { turns: k.rankParam(2, 3) },
    modifiers: [{ stat: "effectRes", value: k.rankParam(2, 2) }],
  });

  if (k.a(1)) {
    k.stat("a2", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 1),
        cap: k.traceParam(1, 2),
      },
    });
  }
  if (k.e(1)) {
    k.stat("e1", { stat: "effectRes", value: k.rankParam(1, 2) });
    k.on("battleStart", "e1", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(1, 1))
    );
  }
  if (k.e(6)) {
    k.stat("e6", { stat: "breakEffect", value: k.rankParam(6, 1) });
    k.stat("e6", { stat: "breakEfficiency", value: k.rankParam(6, 2) });
  }

  /**
   * Restores `amount` HP. panelStat leaves out scaled modifiers, so A2's
   * Outgoing Healing is added here.
   */
  const heal = (ctx: BattleApi, target: UnitView, amount: number) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const a2 = k.a(1)
      ? Math.min(
          k.traceParam(1, 2),
          k.traceParam(1, 1) * ctx.self.panelStat("breakEffect")
        )
      : 0;
    const boost = 1 + ctx.self.panelStat("outgoingHealing") + a2;
    ctx.heal(target, (amount * boost) / maxHp);
  };

  // Talent: each Besotted enemy an ally attack hits heals the attacker (a
  // summon's owner). A6: Nectar Blitz on a Besotted enemy also heals the
  // teammates.
  k.on(
    "actionEnd",
    "talent",
    {
      subject: "ally",
      attack: true,
      when: (event, self) =>
        (event.targetsHit ?? []).some((enemy) => enemy.has(besotted, self)),
    },
    (ctx, event) => {
      const attacker =
        event.unit.kind === "summon" ? event.unit.owner : event.unit;
      if (!attacker) return;
      const amount = k.param("04", 2);
      for (const enemy of event.targetsHit ?? []) {
        if (enemy.has(besotted, ctx.self)) heal(ctx, attacker, amount);
      }
      if (
        k.a(3) &&
        event.unit === ctx.self &&
        event.abilityId === "enhancedBasic"
      ) {
        for (const ally of ctx.allies) {
          if (ally !== ctx.self) heal(ctx, ally, amount);
        }
      }
    }
  );

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Its ATK reduction on the enemy is not modelled (U12).
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    usable: (view) => view.self.has(nectarBlitz),
    hits: [
      { shape: "single", main: k.param("08", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => ctx.removeStatus(ctx.self, nectarBlitz),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      heal(ctx, target, k.param("02", 1));
      if (k.e(2)) ctx.applyStatus(target, lionsTail);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, besotted);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      ctx.applyStatus(ctx.self, nectarBlitz);
      // A4: "immediately advances action for this unit by 100%".
      if (k.a(2)) ctx.advanceAction(ctx.self, 1);
    },
  });

  /** The ally Character with the lowest HP share (ties: the earlier slot). */
  const lowestAlly = (view: PolicyView): UnitView =>
    view.allies.reduce(
      (best, ally) =>
        ally.kind === "character" && ally.hpRatio < best.hpRatio - 1e-9
          ? ally
          : best,
      view.allies.find((ally) => ally.kind === "character") ?? view.self
    );

  // The Skill heals the lowest ally Character when it is low; otherwise
  // Nectar Blitz after an Ultimate, or Basic ATK.
  k.policy({
    turn: (view) => {
      const target = lowestAlly(view);
      if (view.skillPoints >= 1 && target.hpRatio <= LOW_HP + 1e-9) {
        return { ability: "skill", target };
      }
      return view.self.has(nectarBlitz) ? "enhancedBasic" : "basic";
    },
  });
});
