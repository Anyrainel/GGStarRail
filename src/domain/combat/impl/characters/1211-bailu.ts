import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;
/** Damage Paths, preferred as the default E4 teammate before Nihility. */
const DAMAGE_PATHS = ["Warrior", "Rogue", "Mage", "Memory", "Elation"];

/** Bailu — Abundance, Lightning. */
export default defineCharacter("1211", (k) => {
  const qihuangAnalects = k.status({
    id: "qihuang-analects",
    origin: "a2",
    duration: { turns: k.traceParam(1, 2) },
    modifiers: [{ stat: "hpPct", value: k.traceParam(1, 1) }],
  });
  const sylphicSlumber = k.status({
    id: "sylphic-slumber",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "outgoingHealing", value: k.rankParam(2, 1) }],
  });
  const evilExcision = k.status({
    id: "evil-excision",
    origin: "e4",
    duration: { turns: k.rankParam(4, 3) },
    maxStacks: k.rankParam(4, 2),
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(4, 1) }],
  });
  // Stacks are the heals left; it ends when they run out or its turns end.
  const invigorationHeals =
    k.param("04", 5) + (k.a(2) ? k.traceParam(2, 1) : 0);
  const invigoration = k.status({
    id: "invigoration",
    origin: "ultimate",
    duration: { turns: k.param("03", 3) },
    maxStacks: invigorationHeals,
    unique: true,
  });

  /**
   * Restores `ratio` of Bailu's Max HP plus `flat` with probability
   * `chance`. A2: a heal beyond the missing HP raises Max HP.
   */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number,
    chance = 1
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    // panelStat leaves out timed statuses, so E2 is added here.
    const boost =
      1 +
      ctx.self.panelStat("outgoingHealing") +
      (ctx.self.has(sylphicSlumber) ? k.rankParam(2, 1) : 0);
    const share = ((ratio * ctx.self.panelStat("hp") + flat) * boost) / maxHp;
    if (k.a(1) && share > 1 - target.hpRatio + 1e-9) {
      ctx.applyStatus(target, qihuangAnalects, {
        stacks: ctx.weight * chance,
      });
    }
    ctx.heal(target, share * chance);
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // One heal on the target, then random heals, each smaller than the last
  // by the same share, spread over all ally targets as expected values.
  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      heal(ctx, target, k.param("02", 1), k.param("02", 2));
      const randomHeals = k.param("02", 4);
      const share = 1 / ctx.allies.length;
      for (let index = 1; index <= randomHeals; index += 1) {
        const factor = (1 - k.param("02", 3)) ** index;
        for (const ally of ctx.allies) {
          heal(
            ctx,
            ally,
            k.param("02", 1) * factor,
            k.param("02", 2) * factor,
            share
          );
        }
      }
      if (!k.e(4)) return;
      for (const ally of ctx.allies) {
        const first = ally === target ? 1 : 0;
        ctx.applyStatus(ally, evilExcision, {
          stacks: first + randomHeals * share,
        });
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    after: (ctx) => {
      for (const ally of ctx.allies) {
        heal(ctx, ally, k.param("03", 1), k.param("03", 2));
        if (ally.has(invigoration)) {
          ctx.extendStatus(ally, invigoration, 1);
        } else {
          ctx.applyStatus(ally, invigoration, { setStacks: invigorationHeals });
        }
      }
      if (k.e(2)) ctx.applyStatus(ctx.self, sylphicSlumber);
    },
  });

  // Talent: an Invigorated ally heals after being hit, using one of its
  // heals per hit (the hit's aggro share in expectation).
  k.on(
    "hpChanged",
    "talent",
    {
      subject: "ally",
      when: (event, self) =>
        event.hpCause === "enemy" &&
        event.unit.stacks(invigoration, self) > 1e-9,
    },
    (ctx, event) => {
      const chance = Math.min(
        1,
        event.unit.stacks(invigoration, ctx.self) / ctx.weight
      );
      heal(ctx, event.unit, k.param("04", 1), k.param("04", 2), chance);
      ctx.consumeStacks(event.unit, invigoration, ctx.weight * chance);
      if (event.unit.stacks(invigoration, ctx.self) <= 1e-9) {
        ctx.removeStatus(event.unit, invigoration);
      }
    }
  );

  // E1: fixed Energy when Invigoration ends on a Character at full HP.
  if (k.e(1)) {
    k.on(
      "statusRemoved",
      "e1",
      {
        status: invigoration,
        when: (event) =>
          event.target?.kind === "character" &&
          event.target.hpRatio >= 1 - 1e-9,
      },
      (ctx, event) => {
        if (event.target) {
          ctx.gainEnergy(event.target, k.rankParam(1, 1), { fixed: true });
        }
      }
    );
  }

  /** The ally Character with the lowest HP share (ties: the earlier slot). */
  const lowestAlly = (view: PolicyView): UnitView =>
    view.allies.reduce(
      (best, ally) =>
        ally.kind === "character" && ally.hpRatio < best.hpRatio - 1e-9
          ? ally
          : best,
      view.allies.find((ally) => ally.kind === "character") ?? view.self
    );
  // E4: the teammate who receives surplus Skills (default: the first on a
  // damage Path, then the first on Nihility).
  const excisionTarget = k.e(4)
    ? k.ally(
        "evil-excision-target",
        "e4",
        (candidates) =>
          candidates.find((member) => DAMAGE_PATHS.includes(member.pathId)) ??
          candidates.find((member) => member.pathId === "Warlock")
      )
    : null;
  const designatedTeammate = (view: PolicyView): UnitView =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally.slot === excisionTarget?.slot
    ) ?? view.self;

  // The Skill heals the lowest ally Character when it is low. Otherwise Basic
  // ATK keeps Skill Points for the team; at E4 surplus Skill Points go to the
  // Skill's DMG bonus on the designated teammate.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const low = lowestAlly(view);
      if (low.hpRatio <= LOW_HP + 1e-9)
        return { ability: "skill", target: low };
      return k.e(4) && view.skillPoints >= 3
        ? { ability: "skill", target: designatedTeammate(view) }
        : "basic";
    },
  });
});
