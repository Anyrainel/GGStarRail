import { isCombatTypeId } from "@/domain/stats";
import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** March 7th — The Hunt, Imaginary. */
export default defineCharacter("1224", (k) => {
  const CHARGE = "charge";
  const E2_USED = "e2-used";

  // Erudition, Destruction, The Hunt, Remembrance, Elation.
  const damagePaths = ["Mage", "Warrior", "Rogue", "Memory", "Elation"];
  // The player designates Shifu; by default the first damage dealer, else a
  // Nihility ally, else the first teammate.
  const shifuMember = k.ally(
    "shifu",
    "skill",
    (candidates) =>
      candidates.find((member) => damagePaths.includes(member.pathId)) ??
      candidates.find((member) => member.pathId === "Warlock")
  );
  const shifuAddsDamage =
    shifuMember !== null && damagePaths.includes(shifuMember.pathId);
  const shifuType =
    shifuMember && isCombatTypeId(shifuMember.combatType)
      ? shifuMember.combatType
      : k.combatType;
  const isShifu = (unit: UnitView) =>
    shifuMember !== null &&
    unit.kind === "character" &&
    unit.slot === shifuMember.slot;

  const threshold = k.param("04", 1);
  const enhancedPerHit = k.param("08", 1);
  const enhancedToughness = 5;

  const shifu = k.status({
    id: "shifu",
    origin: "skill",
    modifiers: [{ stat: "spdPct", value: k.param("02", 1) }],
  });
  const ascended = k.status({
    id: "ascended",
    origin: "talent",
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 2) }],
  });
  // Marks the next Enhanced Basic ATK as boosted by the Ultimate.
  const apexHeroine = k.status({ id: "apex-heroine", origin: "ultimate" });
  const bestGirl = k.status({
    id: "best-girl-crit-dmg",
    origin: "e6",
    modifiers: [{ stat: "critDmg", value: k.rankParam(6, 1) }],
  });
  const tideTamer = k.status({
    id: "tide-tamer",
    origin: "a6",
    duration: { turns: k.traceParam(3, 3) },
    modifiers: [
      { stat: "critDmg", value: k.traceParam(3, 1) },
      { stat: "breakEffect", value: k.traceParam(3, 2) },
    ],
  });
  const swordStirs = k.status({
    id: "sword-stirs-starlight",
    origin: "e1",
    modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
  });

  const designatedShifu = (allies: readonly UnitView[]) =>
    allies.find((ally) => isShifu(ally) && ally.has(shifu));

  const gainCharge = (ctx: BattleApi, amount: number) => {
    ctx.addCounter(ctx.self, CHARGE, amount, k.param("04", 3));
    if (
      ctx.self.counter(CHARGE) + 1e-9 >= threshold &&
      !ctx.self.has(ascended)
    ) {
      ctx.applyStatus(ctx.self, ascended);
      ctx.advanceAction(ctx.self, 1);
    }
  };

  // Erudition/Destruction/The Hunt/Remembrance/Elation Shifu: Additional
  // DMG of Shifu's Combat Type per Basic ATK or Enhanced Basic ATK hit.
  const shifuAdditional = (ctx: BattleApi, target: EnemyView, weight = 1) => {
    if (!shifuAddsDamage || !designatedShifu(ctx.allies)) return;
    ctx.deal(
      {
        shape: "single",
        main: k.param("02", 2),
        combatType: shifuType,
        onlyTags: ["additional"],
      },
      { targets: [target], origin: "skill", weight }
    );
  };
  // A single-target hit with the designated Shifu's effects on Toughness:
  // on Basic ATK hits (`pathEffect`), a Harmony/Nihility/Preservation/
  // Abundance Shifu raises it by #3; A4 lets every attack reduce it on
  // enemies weak to Shifu's Combat Type (Imaginary Break).
  const shifuHit = (
    ctx: BattleApi,
    target: UnitView | null,
    main: number,
    toughness: number,
    pathEffect = true
  ): HitDef => {
    const designated = designatedShifu(ctx.allies) !== undefined;
    const scale =
      pathEffect && designated && !shifuAddsDamage ? 1 + k.param("02", 3) : 1;
    const weakToShifu =
      k.a(2) &&
      designated &&
      isEnemy(target) &&
      target.weaknesses.has(shifuType);
    return {
      shape: "single",
      main,
      toughness: { main: toughness * scale },
      ...(weakToShifu ? { toughnessWithoutWeakness: 1 } : {}),
    };
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: (ctx) => [shifuHit(ctx, ctx.target, k.param("01", 1), 10)],
    after: (ctx) => {
      if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target);
      gainCharge(ctx, k.param("01", 2));
    },
  });

  // Enhanced Basic ATK: the initial hits land; each extra hit rolls after
  // the previous final hit, so the i-th extra lands with chance^i and is
  // dealt with that weight (its Shifu Additional DMG too).
  const enhancedBasic = (id: string, afterUltimate: boolean) => {
    const initialHits =
      k.param("08", 4) + (afterUltimate ? k.param("03", 2) : 0);
    const chance = Math.min(
      1,
      k.param("08", 2) + (afterUltimate ? k.param("03", 3) : 0)
    );
    k.ability({
      id,
      kind: "basic",
      skillPoints: 0,
      energy: 30,
      before: (ctx) => {
        if (afterUltimate && k.e(6)) ctx.applyStatus(ctx.self, bestGirl);
      },
      hits: (ctx) =>
        Array.from({ length: initialHits }, () =>
          shifuHit(ctx, ctx.target, enhancedPerHit, enhancedToughness)
        ),
      afterHit: (ctx) => {
        if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target);
      },
      after: (ctx) => {
        const target = ctx.target;
        if (isEnemy(target)) {
          for (let extra = 1; extra <= k.param("08", 3); extra += 1) {
            const weight = chance ** extra;
            ctx.deal(shifuHit(ctx, target, enhancedPerHit, enhancedToughness), {
              targets: [target],
              tags: ["basic"],
              weight,
            });
            shifuAdditional(ctx, target, weight);
          }
        }
        ctx.removeStatus(ctx.self, bestGirl);
        ctx.setCounter(
          ctx.self,
          CHARGE,
          Math.max(0, ctx.self.counter(CHARGE) - threshold)
        );
        if (ctx.self.counter(CHARGE) + 1e-9 < threshold) {
          ctx.removeStatus(ctx.self, ascended);
        }
        if (afterUltimate) ctx.removeStatus(ctx.self, apexHeroine);
        const master = designatedShifu(ctx.allies);
        if (k.a(3) && master) ctx.applyStatus(master, tideTamer);
      },
    });
  };
  enhancedBasic("enhancedBasic", false);
  enhancedBasic("enhancedBasicUlt", true);

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const master =
        ctx.target && !isEnemy(ctx.target) && ctx.target !== ctx.self
          ? ctx.target
          : ctx.allies.find(isShifu);
      if (!master) return;
      for (const ally of ctx.allies) {
        if (ally !== master) ctx.removeStatus(ally, shifu);
      }
      ctx.applyStatus(master, shifu);
      if (k.e(1)) ctx.applyStatus(ctx.self, swordStirs);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: (ctx) => [shifuHit(ctx, ctx.target, k.param("03", 1), 30, false)],
    after: (ctx) => ctx.applyStatus(ctx.self, apexHeroine),
  });

  k.on("actionEnd", "talent", { subject: "otherAlly" }, (ctx, event) => {
    if (!isShifu(event.unit) || !event.unit.has(shifu)) return;
    if (!event.attack && event.abilityKind !== "ultimate") return;
    gainCharge(ctx, 1);
  });

  if (k.e(2)) {
    // No facts row: Energy from the Talent's (122404); the game's ability
    // config gives it Basic ATK Toughness (10) with Shifu's bonus, in two
    // hits of 40%/60%. Shifu's Additional DMG is one instance.
    k.ability({
      id: "followUp",
      kind: "followUp",
      energy: 5,
      hits: (ctx) =>
        [0.4, 0.6].map((share) =>
          shifuHit(ctx, ctx.target, k.rankParam(2, 1) * share, 10 * share)
        ),
      after: (ctx) => {
        if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target);
        gainCharge(ctx, k.rankParam(2, 3));
      },
    });
    k.on("turnStart", "e2", { subject: "any" }, (ctx) =>
      ctx.setCounter(ctx.self, E2_USED, 0)
    );
    k.on(
      "actionEnd",
      "e2",
      { subject: "otherAlly", abilityKinds: ["basic", "skill"], attack: true },
      (ctx, event) => {
        if (!isShifu(event.unit) || !event.unit.has(shifu)) return;
        if (!isEnemy(event.target) || ctx.self.counter(E2_USED) > 0) return;
        ctx.setCounter(ctx.self, E2_USED, 1);
        ctx.queueAction(ctx.self, "followUp", { target: event.target });
      }
    );
  }

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(1, 1))
    );
  }
  if (k.e(4)) {
    k.on("turnStart", "e4", { subject: "self" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }

  // Skill once to designate Shifu, then SP-positive Basic ATKs; the Enhanced
  // Basic ATK whenever Charge allows it.
  k.policy({
    turn: (view) => {
      if (view.self.has(ascended)) {
        return view.self.has(apexHeroine)
          ? "enhancedBasicUlt"
          : "enhancedBasic";
      }
      const master = view.allies.find(isShifu);
      if (master && !master.has(shifu) && view.skillPoints >= 1) {
        return { ability: "skill", target: master };
      }
      return "basic";
    },
  });
});
