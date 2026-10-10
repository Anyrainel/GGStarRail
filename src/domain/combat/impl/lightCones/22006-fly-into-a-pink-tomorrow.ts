import { canonicalCharacterId } from "@/domain/characterIdentity";
import { defineLightCone } from "../../kit/equipment";

/** Fly Into a Pink Tomorrow — Remembrance. CRIT DMG is applied from catalog properties. */
export default defineLightCone("22006", (k) => {
  if (canonicalCharacterId(k.wearer.characterId) !== "8007") return;
  // "All ally targets": the team aura also reaches memosprites.
  k.teamStat("lightCone", { stat: "dmgBoost", value: k.s(2) }, "allies");
  // The Enhanced Basic ATK "Together, We Script Tomorrow!" (#3) is not in
  // the Trailblazer's kit or skill data (tracker
  // fly-into-a-pink-tomorrow-enhanced-basic).
});
