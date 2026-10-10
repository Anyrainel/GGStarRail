import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Firefly — Destruction, Fire. */
export default defineCharacter("1310", (k) => {
  const combustionModifiers: ModifierDef[] = [
    { stat: "spdFlat", value: k.param("03", 3) },
    { stat: "effectRes", value: k.param("04", 4) },
  ];
  if (k.a(2)) {
    // Super Break at 35% from 200% Break Effect, 50% from 360%.
    combustionModifiers.push(
      {
        stat: "superBreakDmg",
        scaling: {
          source: "holder",
          stat: "breakEffect",
          atLeast: k.traceParam(2, 1),
          ratio: k.traceParam(2, 3),
        },
      },
      {
        stat: "superBreakDmg",
        scaling: {
          source: "holder",
          stat: "breakEffect",
          atLeast: k.traceParam(2, 2),
          ratio: k.traceParam(2, 4) - k.traceParam(2, 3),
        },
      }
    );
  }
  if (k.e(4)) {
    combustionModifiers.push({ stat: "effectRes", value: k.rankParam(4, 1) });
  }
  if (k.e(6)) {
    combustionModifiers.push({
      stat: "resPen",
      value: k.rankParam(6, 1),
      filter: { combatTypes: ["Fire"] },
    });
  }
  // Complete Combustion lasts until its countdown's turn starts.
  const combustion = k.status({
    id: "complete-combustion",
    origin: "ultimate",
    modifiers: combustionModifiers,
  });

  // "Lasting until this current attack ends": these exist only while an
  // Enhanced Basic ATK or Enhanced Skill resolves.
  const enhancedAttack = k.status({
    id: "enhanced-attack",
    origin: "ultimate",
    modifiers: [
      {
        stat: "breakEfficiency",
        value: k.param("03", 2) + (k.e(6) ? k.rankParam(6, 2) : 0),
      },
    ],
  });
  // The Break DMG increase is read as taken by the enemy (Vulnerability) but
  // scoped to SAM's attack, so it is not shown as a debuff.
  const breakTaken = k.status({
    id: "break-dmg-taken",
    origin: "ultimate",
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("03", 1),
        filter: { tags: ["break"] },
      },
    ],
  });
  const e1DefIgnore = k.status({
    id: "e1-def-ignore",
    origin: "e1",
    modifiers: k.e(1) ? [{ stat: "defIgnore", value: k.rankParam(1, 1) }] : [],
  });

  // Enhanced Skill: (#5 × Break Effect + #1) on the target and
  // (#6 × Break Effect + #2) on adjacent targets, Break Effect capped at #7.
  // The two rows differ, so each is a status active only for its own hits.
  const breakEffectCap = k.param("09", 7);
  const deathstarRow = (id: string, ratio: number) =>
    k.status({
      id,
      origin: "skill",
      modifiers: [
        {
          stat: "multiplierBoost",
          scaling: {
            source: "holder",
            stat: "breakEffect",
            ratio,
            cap: ratio * breakEffectCap,
          },
        },
      ],
    });
  const deathstarMain = deathstarRow("deathstar-main", k.param("09", 5));
  const deathstarAdjacent = deathstarRow(
    "deathstar-adjacent",
    k.param("09", 6)
  );

  if (k.a(3)) {
    k.stat("a6", {
      stat: "breakEffect",
      scaling: {
        source: "holder",
        stat: "atk",
        threshold: k.traceParam(3, 1),
        step: k.traceParam(3, 2),
        ratio: k.traceParam(3, 3),
      },
    });
  }

  const startEnhanced = (ctx: ActionContext) => {
    ctx.applyStatus(ctx.self, enhancedAttack);
    for (const enemy of ctx.enemies) ctx.applyStatus(enemy, breakTaken);
  };
  const endEnhanced = (ctx: ActionContext) => {
    ctx.removeStatus(ctx.self, enhancedAttack);
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, breakTaken);
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
    energy: 0,
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    before: (ctx) =>
      ctx.gainEnergy(ctx.self, k.param("02", 3) * ctx.self.maxEnergy, {
        fixed: true,
      }),
    after: (ctx) => ctx.advanceAction(ctx.self, k.param("02", 4)),
  });

  const countdown = k.summon({
    id: "complete-combustion-countdown",
    speed: k.param("03", 4),
    policy: () => "end",
    abilities: [
      {
        id: "end",
        kind: "other",
        target: "none",
        after: (ctx) => {
          const sam = ctx.self.owner;
          if (sam) ctx.removeStatus(sam, combustion);
          ctx.dismiss(ctx.self);
        },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    usable: (view) => !view.self.has(combustion),
    after: (ctx) => {
      ctx.applyStatus(ctx.self, combustion);
      ctx.summon(ctx.self, countdown.id);
      ctx.advanceAction(ctx.self, 1);
    },
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 0,
    hits: [
      { shape: "single", main: k.param("08", 1), toughness: { main: 15 } },
    ],
    before: startEnhanced,
    after: endEnhanced,
  });

  const adjacentTo = (ctx: ActionContext, target: EnemyView): EnemyView[] => {
    const index = ctx.enemies.indexOf(target);
    return [ctx.enemies[index - 1], ctx.enemies[index + 1]].filter(
      (enemy): enemy is EnemyView => enemy !== undefined
    );
  };

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    energy: 0,
    skillPoints: k.e(1) ? 0 : -1,
    hits: [
      { shape: "single", main: k.param("09", 1), toughness: { main: 30 } },
    ],
    before: (ctx) => {
      // The implanted Weakness has no duration in the engine (tracked).
      if (isEnemy(ctx.target)) ctx.implantWeakness(ctx.target, "Fire");
      startEnhanced(ctx);
      if (k.e(1)) ctx.applyStatus(ctx.self, e1DefIgnore);
      ctx.applyStatus(ctx.self, deathstarMain);
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, deathstarMain);
      const target = ctx.target;
      const adjacent = isEnemy(target) ? adjacentTo(ctx, target) : [];
      if (adjacent.length > 0) {
        ctx.applyStatus(ctx.self, deathstarAdjacent);
        ctx.deal(
          {
            shape: "aoe",
            each: k.param("09", 2),
            toughness: { each: 15 },
          },
          {
            targets: adjacent,
            tags: ["skill"],
            abilityKind: "skill",
            origin: "skill",
          }
        );
        ctx.removeStatus(ctx.self, deathstarAdjacent);
      }
      ctx.removeStatus(ctx.self, e1DefIgnore);
      endEnhanced(ctx);
    },
  });

  if (k.e(2)) {
    // Kills are not simulated; the option stands for Enhanced attacks that
    // defeat an enemy.
    const defeats = k.toggle("e2-defeat", "e2", "enemyDefeated", false);
    const cooldown = k.status({
      id: "e2-cooldown",
      origin: "e2",
      duration: { turns: k.rankParam(2, 2) },
    });
    const extraTurn = (ctx: BattleApi) => {
      if (!ctx.self.has(combustion) || ctx.self.has(cooldown)) return;
      ctx.applyStatus(ctx.self, cooldown);
      ctx.grantExtraTurn(ctx.self);
    };
    const enhanced = { abilityKinds: ["basic", "skill"] } as const;
    k.on("weaknessBreak", "e2", enhanced, extraTurn);
    if (defeats) k.on("actionEnd", "e2", enhanced, extraTurn);
  }

  // In Complete Combustion: Enhanced Skill when it is affordable, else
  // Enhanced Basic ATK. Outside it: Skill for its Energy whenever possible.
  k.policy({
    turn: (view) => {
      const affordable = k.e(1) || view.skillPoints >= 1;
      if (view.self.has(combustion)) {
        return affordable ? "enhancedSkill" : "enhancedBasic";
      }
      return view.skillPoints >= 1 ? "skill" : "basic";
    },
  });
});
