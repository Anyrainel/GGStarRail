import { canonicalCharacterId } from "@/domain/characterIdentity";
import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Inherently Unjust Destiny — Preservation. DEF is applied from catalog
 * properties.
 */
export default defineLightCone("23023", (k) => {
  const allIn = k.status({
    id: "all-in",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  const dmgTaken = k.status({
    id: "all-in-dmg-taken",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(6) },
    modifiers: [{ stat: "vulnerability", value: k.s(5) }],
  });

  // Shields are not simulated: the ability IDs with which known wearers
  // provide Shields (all Traces assumed, Eidolons not visible), and whether
  // they do at battle start. Other wearers shield with Skill and Ultimate.
  const shieldSources: Readonly<
    Record<string, { abilities: readonly string[]; battleStart?: boolean }>
  > = {
    "1001": { abilities: ["skill"] },
    "1104": { abilities: ["ultimate"] },
    "1208": { abilities: [] },
    // Aventurine: A4 at battle start, A6 after his Follow-Up ATK.
    "1304": { abilities: ["skill", "followUp"], battleStart: true },
    "1414": { abilities: ["skill", "ultimate"] },
    // Trailblazer: the Talent's Shield.
    "8003": { abilities: ["basic", "enhancedBasic", "skill", "ultimate"] },
  };
  const sources = shieldSources[canonicalCharacterId(k.wearer.characterId)] ?? {
    abilities: ["skill", "ultimate"],
  };
  if (sources.battleStart) {
    k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, allIn)
    );
  }
  k.on(
    "actionEnd",
    "lightCone",
    { when: (event) => sources.abilities.includes(event.abilityId ?? "") },
    (ctx) => ctx.applyStatus(ctx.self, allIn)
  );

  // A hit expected less than once on this target (a Counter, a share of a
  // Bounce) scales the base chance.
  k.on("hit", "lightCone", { abilityKinds: ["followUp"] }, (ctx, event) => {
    if (!isEnemy(event.target)) return;
    ctx.applyStatus(event.target, dmgTaken, {
      baseChance: k.s(4) * Math.min(1, ctx.weight),
    });
  });
});
