import { canonicalCharacterId } from "@/domain/characterIdentity";
import { defineRelicSet } from "../../kit/equipment";

/**
 * "Trailblaze Companions" are not listed in the reference data. Assumed: the
 * Astral Express crew (Trailblazer, March 7th, Dan Heng, Himeko, Welt, and
 * their variants). Canonical Character IDs.
 */
const TRAILBLAZE_COMPANIONS: ReadonlySet<string> = new Set([
  "8001",
  "8003",
  "8005",
  "8007",
  "8009",
  "1001",
  "1224",
  "1002",
  "1213",
  "1414",
  "1003",
  "1510",
  "1004",
]);

/** Fallen Star Anchorage. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("327", {
  twoPiece: (k) => {
    const wearer = canonicalCharacterId(k.wearer.characterId);
    if (!TRAILBLAZE_COMPANIONS.has(wearer)) return;
    const companion = k.team.some(
      (member) =>
        member.characterId !== wearer &&
        TRAILBLAZE_COMPANIONS.has(canonicalCharacterId(member.characterId))
    );
    if (companion) k.stat("ornament", { stat: "critDmg", value: k.param(2) });
  },
});
