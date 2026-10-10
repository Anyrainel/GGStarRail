import { defineLightCone } from "../../kit/equipment";

/**
 * Time Waits for No One — Abundance. Max HP and Outgoing Healing are applied
 * from catalog properties.
 */
export default defineLightCone("23013", () => {
  // The Additional DMG equals a share of the healing the wearer recorded.
  // Heal amounts are not simulated, so it is not modeled (tracker
  // time-waits-for-no-one-healing-record).
});
