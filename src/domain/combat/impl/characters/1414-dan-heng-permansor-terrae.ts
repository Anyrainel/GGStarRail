import type {
  ActionContext,
  BattleApi,
  EnemyView,
  PolicyView,
  UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { EffectOrigin, HitDef } from "../../kit/model";

/** Dan Heng • Permansor Terrae — Preservation, Physical. */
export default defineCharacter("1414", (k) => {
  const ENHANCED = "souldragon-enhanced";

  const bondmate = k.status({ id: "bondmate", origin: "skill" });
  const empyreanity = k.status({
    id: "empyreanity",
    origin: "a2",
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "applier", stat: "atk", ratio: k.traceParam(1, 1) },
      },
    ],
  });
  const shedScales = k.status({
    id: "shed-scales-of-old",
    origin: "e1",
    duration: { turns: k.rankParam(1, 3) },
    modifiers: [{ stat: "resPen", value: k.rankParam(1, 2) }],
  });
  const enfoldDefIgnore = k.status({
    id: "one-dream-def-ignore",
    origin: "e6",
    modifiers: [{ stat: "defIgnore", value: k.rankParam(6, 3) }],
  });
  // A field effect while the Bondmate exists, not an applied debuff.
  const enfoldVulnerability = k.status({
    id: "one-dream-dmg-taken",
    origin: "e6",
    modifiers: [{ stat: "vulnerability", value: k.rankParam(6, 1) }],
  });

  const bondmateOf = (allies: readonly UnitView[]) =>
    allies.find((ally) => ally.kind === "character" && ally.has(bondmate));

  // Bondmate heuristic: the team's damage dealer, whose ATK scales the
  // Souldragon's Additional DMG. Damage Paths first, then Nihility (DoT
  // carries), then the highest ATK; Dan Heng himself only when alone.
  const damagePaths = new Set([
    "Warrior",
    "Rogue",
    "Mage",
    "Memory",
    "Elation",
  ]);
  const pathRank = (unit: UnitView) =>
    damagePaths.has(unit.pathId) ? 2 : unit.pathId === "Warlock" ? 1 : 0;
  const preferredBondmate = (view: PolicyView): UnitView => {
    let best: UnitView | null = null;
    for (const ally of view.allies) {
      if (ally.kind !== "character" || ally === view.self) continue;
      if (!best) {
        best = ally;
        continue;
      }
      const rank = pathRank(ally) - pathRank(best);
      if (
        rank > 0 ||
        (rank === 0 && ally.panelStat("atk") > best.panelStat("atk") + 1e-9)
      ) {
        best = ally;
      }
    }
    return best ?? view.self;
  };

  // Shields and debuff dispels are not modelled: a plain Souldragon action
  // only takes its place in the Action Order.
  const enhancedActions = k.param("03", 3) + (k.e(2) ? k.rankParam(2, 1) : 0);
  // E2: "the Additional DMG dealt by the Bondmate becomes 200% of its
  // original DMG" during enhanced actions; the kit deals these instances
  // itself, so the factor scales their multipliers (A6's instance included).
  const e2Scale = k.e(2) ? k.rankParam(2, 2) : 1;

  /** Additional DMG of the Bondmate's Type, dealt by the Bondmate. */
  const bondmateAdditional = (
    ctx: BattleApi,
    mate: UnitView,
    hit: HitDef,
    abilityId: string,
    origin: EffectOrigin,
    targets?: readonly EnemyView[]
  ) =>
    ctx.deal(
      { ...hit, onlyTags: ["additional"], combatType: mate.combatType },
      {
        attacker: mate,
        abilityId,
        abilityKind: "other",
        origin,
        ...(targets ? { targets } : {}),
      }
    );

  const souldragon = k.summon({
    id: "souldragon",
    speed: k.param("04", 5),
    policy: (view) =>
      (view.self.owner?.counter(ENHANCED) ?? 0) > 1e-9
        ? "souldragon-follow-up"
        : "souldragon-action",
    abilities: [
      { id: "souldragon-action", kind: "other", target: "allies" },
      {
        id: "souldragon-follow-up",
        kind: "followUp",
        // Facts: the Talent row carries the Souldragon's AoE Toughness (20).
        hits: [
          { shape: "aoe", each: k.param("03", 2), toughness: { each: 20 } },
        ],
        after: (ctx) => {
          const owner = ctx.self.owner;
          if (!owner) return;
          const mate = bondmateOf(ctx.allies);
          if (mate) {
            bondmateAdditional(
              ctx,
              mate,
              { shape: "aoe", each: k.param("03", 8) * e2Scale },
              "souldragon-additional",
              "ultimate"
            );
            // "The enemy whose current HP is the highest": the boss, which
            // is the scenario's main target.
            if (k.a(3) && ctx.mainTarget) {
              bondmateAdditional(
                ctx,
                mate,
                { shape: "single", main: k.traceParam(3, 1) * e2Scale },
                "sublimity-additional",
                "a6",
                [ctx.mainTarget]
              );
            }
          }
          ctx.setCounter(
            owner,
            ENHANCED,
            Math.max(0, owner.counter(ENHANCED) - 1)
          );
        },
      },
    ],
  });

  const designate = (ctx: ActionContext, target: UnitView) => {
    for (const ally of ctx.allies) {
      if (ally === target) continue;
      ctx.removeStatus(ally, bondmate);
      ctx.removeStatus(ally, empyreanity);
      ctx.removeStatus(ally, enfoldDefIgnore);
    }
    ctx.applyStatus(target, bondmate);
    if (k.a(1)) ctx.applyStatus(target, empyreanity);
    if (k.e(6)) {
      ctx.applyStatus(target, enfoldDefIgnore);
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, enfoldVulnerability);
      }
    }
    if (!ctx.findSummon(ctx.self, souldragon.id)) {
      ctx.summon(ctx.self, souldragon.id);
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const chosen = ctx.target;
      designate(ctx, chosen?.kind === "character" ? chosen : ctx.self);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    before: (ctx) => {
      if (!k.e(1)) return;
      ctx.gainSkillPoints(k.rankParam(1, 1));
      const mate = bondmateOf(ctx.allies);
      if (mate) ctx.applyStatus(mate, shedScales);
    },
    after: (ctx) => {
      ctx.setCounter(ctx.self, ENHANCED, enhancedActions);
      const mate = bondmateOf(ctx.allies);
      if (k.e(6) && mate) {
        bondmateAdditional(
          ctx,
          mate,
          { shape: "aoe", each: k.rankParam(6, 2) },
          "one-dream-additional",
          "e6"
        );
      }
      if (k.e(2)) {
        const dragon = ctx.findSummon(ctx.self, souldragon.id);
        if (dragon) ctx.advanceAction(dragon, 1);
      }
    },
  });

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(2, 1))
    );
    k.on(
      "actionEnd",
      "a4",
      {
        subject: "ally",
        attack: true,
        when: (event, self) =>
          event.unit.kind === "character" && event.unit.has(bondmate, self),
      },
      (ctx) => {
        ctx.gainEnergy(ctx.self, k.traceParam(2, 2));
        const dragon = ctx.findSummon(ctx.self, souldragon.id);
        if (dragon) ctx.advanceAction(dragon, k.traceParam(2, 3));
      }
    );
  }

  // Skill designates the Bondmate; afterwards Basic ATK feeds Skill Points
  // (Souldragon keeps shields up), with a Skill only when a Basic ATK would
  // overflow the Skill Point cap.
  k.policy({
    turn: (view) => {
      const preferred = preferredBondmate(view);
      if (!preferred.has(bondmate) || view.skillPoints >= view.maxSkillPoints) {
        return { ability: "skill", target: preferred };
      }
      return "basic";
    },
    ultimate: (view) => bondmateOf(view.allies) !== undefined,
  });
});
