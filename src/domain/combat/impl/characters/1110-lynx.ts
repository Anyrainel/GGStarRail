import {
  type ActionContext,
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import type { TeamMemberInfo } from "../../kit/builder";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;

/** Lynx — Abundance, Quantum. */
export default defineCharacter("1110", (k) => {
  const responseModifiers: ModifierDef[] = [
    {
      stat: "hpFlat",
      value: k.param("02", 2),
      scaling: {
        source: "applier",
        stat: "hp",
        ratio: k.param("02", 1) + (k.e(6) ? k.rankParam(6, 1) : 0),
      },
    },
  ];
  if (k.e(6)) {
    responseModifiers.push({ stat: "effectRes", value: k.rankParam(6, 2) });
  }
  const survivalResponse = k.status({
    id: "survival-response",
    origin: "skill",
    duration: { turns: k.param("02", 3) },
    modifiers: responseModifiers,
  });
  // Survival Response's aggro increase (#6), only on Destruction and
  // Preservation holders; it lasts as long.
  const responseAggro = k.status({
    id: "survival-response-aggro",
    origin: "skill",
    duration: { turns: k.param("02", 3) },
    modifiers: [{ stat: "aggroPct", value: k.param("02", 6) }],
  });
  const warmCampfire = k.status({
    id: "dusk-of-warm-campfire",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "applier", stat: "hp", ratio: k.rankParam(4, 1) },
      },
    ],
  });
  // Talent: continuous healing at the start of the holder's turns.
  const outdoorSurvival = k.status({
    id: "outdoor-survival-experience",
    origin: "talent",
    duration: {
      turns: k.param("04", 1) + (k.a(3) ? k.traceParam(3, 1) : 0),
    },
  });

  /**
   * Restores `ratio` of Lynx's Max HP plus `flat`. E1 adds Outgoing Healing
   * on targets at 50% HP or lower.
   */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const e1 =
      k.e(1) && target.hpRatio <= k.rankParam(1, 1) + 1e-9
        ? k.rankParam(1, 2)
        : 0;
    const amount = ratio * ctx.self.panelStat("hp") + flat;
    const boost = 1 + ctx.self.panelStat("outgoingHealing") + e1;
    ctx.heal(target, (amount * boost) / maxHp);
  };

  const allyTarget = (ctx: ActionContext): UnitView =>
    ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;

  // Survival Response goes to a designated ally. The default is the carry:
  // Destruction first (the usual HP-scaling partners, who also draw the
  // aggro), then other damage Paths, then Nihility, then the earliest slot;
  // Lynx herself only when alone.
  const pathRank = (member: TeamMemberInfo) => {
    if (member.characterId === k.id) return -1;
    if (member.pathId === "Warrior") return 3;
    if (["Rogue", "Mage", "Memory", "Elation"].includes(member.pathId)) {
      return 2;
    }
    return member.pathId === "Warlock" ? 1 : 0;
  };
  const designated = k.ally(
    "survival-response-target",
    "skill",
    (candidates) =>
      candidates.reduce<TeamMemberInfo | undefined>(
        (best, member) =>
          !best || pathRank(member) > pathRank(best) ? member : best,
        undefined
      ),
    { includeSelf: true }
  );
  const responseTarget = (view: PolicyView): UnitView =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally.slot === designated?.slot
    ) ?? view.self;

  /** The ally Character with the lowest HP share (ties: the earlier slot). */
  const lowestAlly = (view: PolicyView): UnitView =>
    view.allies.reduce(
      (best, ally) =>
        ally.kind === "character" && ally.hpRatio < best.hpRatio - 1e-9
          ? ally
          : best,
      view.allies.find((ally) => ally.kind === "character") ?? view.self
    );

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
      const target = allyTarget(ctx);
      ctx.applyStatus(target, survivalResponse);
      if (target.pathId === "Warrior" || target.pathId === "Knight") {
        ctx.applyStatus(target, responseAggro);
      }
      if (k.e(4)) ctx.applyStatus(target, warmCampfire);
      heal(ctx, target, k.param("02", 4), k.param("02", 5));
      ctx.applyStatus(target, outdoorSurvival);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    after: (ctx) => {
      for (const ally of ctx.allies) {
        heal(ctx, ally, k.param("03", 2), k.param("03", 3));
        ctx.applyStatus(ally, outdoorSurvival);
      }
    },
  });

  // The continuous healing restores more while the holder has Survival
  // Response.
  k.on(
    "turnStart",
    "talent",
    {
      subject: "ally",
      when: (event, self) => event.unit.has(outdoorSurvival, self),
    },
    (ctx, event) => {
      const response = event.unit.has(survivalResponse);
      heal(
        ctx,
        event.unit,
        k.param("04", 2) + (response ? k.param("04", 4) : 0),
        k.param("04", 3) + (response ? k.param("04", 5) : 0)
      );
    }
  );

  if (k.a(1)) {
    k.on(
      "hitByEnemy",
      "a2",
      {
        subject: "ally",
        when: (event, self) => event.unit.has(survivalResponse, self),
      },
      (ctx) => ctx.gainEnergy(ctx.self, k.traceParam(1, 1))
    );
  }

  // Skill the lowest ally Character when it is low; otherwise keep Survival
  // Response on the designated ally, Skill when a Basic ATK would overflow
  // the Skill Point cap, and Basic ATK.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const low = lowestAlly(view);
      if (low.hpRatio <= LOW_HP + 1e-9)
        return { ability: "skill", target: low };
      const target = responseTarget(view);
      return !target.has(survivalResponse) ||
        view.skillPoints >= view.maxSkillPoints
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
