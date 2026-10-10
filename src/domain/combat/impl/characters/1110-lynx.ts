import type { PolicyView, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

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
  // The aggro increase for Destruction/Preservation targets is not modelled.
  const survivalResponse = k.status({
    id: "survival-response",
    origin: "skill",
    duration: { turns: k.param("02", 3) },
    modifiers: responseModifiers,
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

  // Survival Response goes to the carry: Destruction first (the usual
  // HP-scaling partners, who also draw the aggro), then other damage Paths,
  // then Nihility, then the highest Max HP; Lynx herself only when alone.
  const pathRank = (unit: UnitView) => {
    if (unit.pathId === "Warrior") return 3;
    if (["Rogue", "Mage", "Memory", "Elation"].includes(unit.pathId)) return 2;
    return unit.pathId === "Warlock" ? 1 : 0;
  };
  const responseTarget = (view: PolicyView): UnitView => {
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
        (rank === 0 && ally.panelStat("hp") > best.panelStat("hp") + 1e-9)
      ) {
        best = ally;
      }
    }
    return best ?? view.self;
  };

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

  // Healing (instant and continuous) is not modelled.
  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const target = ctx.target?.kind === "character" ? ctx.target : ctx.self;
      ctx.applyStatus(target, survivalResponse);
      if (k.e(4)) ctx.applyStatus(target, warmCampfire);
    },
  });

  k.ability({ id: "ultimate", kind: "ultimate", target: "allies" });

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

  // Keep Survival Response on the carry; otherwise Basic ATK, with a Skill
  // when a Basic ATK would overflow the Skill Point cap.
  k.policy({
    turn: (view) => {
      const target = responseTarget(view);
      if (
        !target.has(survivalResponse) ||
        view.skillPoints >= view.maxSkillPoints
      ) {
        return { ability: "skill", target };
      }
      return "basic";
    },
  });
});
