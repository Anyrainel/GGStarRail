import { canonicalCharacterId } from "@/domain/characterIdentity";
import { isCombatTypeId } from "@/domain/stats";
import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** March 7th — The Hunt, Imaginary. */
export default defineCharacter("1224", (k) => {
  const CHARGE = "charge";
  const E2_USED = "e2-used";

  // Erudition, Destruction, The Hunt, Remembrance, Elation.
  const damagePaths = ["Mage", "Warrior", "Rogue", "Memory", "Elation"];
  const others = k.team.filter((member) => member.characterId !== k.id);
  // The engine cannot pick an ally target: Shifu is the first damage
  // dealer, else a Nihility ally, else the first teammate.
  const shifuMember =
    others.find((member) => damagePaths.includes(member.pathId)) ??
    others.find((member) => member.pathId === "Warlock") ??
    others[0];
  const shifuAddsDamage =
    shifuMember !== undefined && damagePaths.includes(shifuMember.pathId);
  const shifuType =
    shifuMember && isCombatTypeId(shifuMember.combatType)
      ? shifuMember.combatType
      : k.combatType;
  const isShifu = (unit: UnitView) =>
    shifuMember !== undefined &&
    unit.kind === "character" &&
    canonicalCharacterId(unit.definitionId) === shifuMember.characterId;

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
  const shifuAdditional = (
    ctx: BattleApi,
    target: EnemyView,
    scales: readonly number[]
  ) => {
    if (!shifuAddsDamage || !designatedShifu(ctx.allies)) return;
    for (const scale of scales) {
      ctx.deal(
        {
          shape: "single",
          main: k.param("02", 2) * scale,
          combatType: shifuType,
          onlyTags: ["additional"],
        },
        { targets: [target], origin: "skill" }
      );
    }
  };
  // Harmony/Nihility/Preservation/Abundance Shifu: +100% Toughness Reduction
  // per hit, kept on the hits so a break lands on the right one. Shifu is
  // designated on March's first turn, so only Basic ATKs before it overstate.
  const toughnessScale =
    shifuMember !== undefined && !shifuAddsDamage ? 1 + k.param("02", 3) : 1;

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        toughness: { main: 10 * toughnessScale },
      },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target, [1]);
      gainCharge(ctx, k.param("01", 2));
    },
  });

  // Extra hits roll after each final hit: the i-th lands with chance^i, so
  // each extra hit carries its probability in its multiplier and Toughness.
  const enhancedScales = (bonusHits: number, bonusChance: number) => {
    const chance = Math.min(1, k.param("08", 2) + bonusChance);
    const scales: number[] = Array.from(
      { length: k.param("08", 4) + bonusHits },
      () => 1
    );
    for (let extra = 1; extra <= k.param("08", 3); extra += 1) {
      scales.push(chance ** extra);
    }
    return scales;
  };

  const enhancedBasic = (id: string, afterUltimate: boolean) => {
    const scales = afterUltimate
      ? enhancedScales(k.param("03", 2), k.param("03", 3))
      : enhancedScales(0, 0);
    k.ability({
      id,
      kind: "basic",
      skillPoints: 0,
      energy: 30,
      before: (ctx) => {
        if (afterUltimate && k.e(6)) ctx.applyStatus(ctx.self, bestGirl);
      },
      hits: scales.map((scale) => ({
        shape: "single" as const,
        main: enhancedPerHit * scale,
        toughness: { main: enhancedToughness * toughnessScale * scale },
      })),
      after: (ctx) => {
        ctx.removeStatus(ctx.self, bestGirl);
        if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target, scales);
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
      const master = ctx.allies.find(isShifu);
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
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => ctx.applyStatus(ctx.self, apexHeroine),
  });

  k.on("actionEnd", "talent", { subject: "otherAlly" }, (ctx, event) => {
    if (!isShifu(event.unit) || !event.unit.has(shifu)) return;
    if (!event.attack && event.abilityKind !== "ultimate") return;
    gainCharge(ctx, 1);
  });

  if (k.e(2)) {
    // The talent's facts (122404) carry this attack's Energy and Toughness.
    k.ability({
      id: "followUp",
      kind: "followUp",
      energy: 5,
      hits: [{ shape: "single", main: k.rankParam(2, 1) }],
      after: (ctx) => {
        if (isEnemy(ctx.target)) shifuAdditional(ctx, ctx.target, [1]);
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
      if (master && !master.has(shifu) && view.skillPoints >= 1) return "skill";
      return "basic";
    },
  });
});
