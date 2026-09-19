import { COMBAT_TYPE_RGB, TIER_COLORS } from "@/config/gameColors";
import type { PriorityTier } from "@/domain/tier-list/types";

export function combatTypeColor(id: string): string | undefined {
  const rgb = COMBAT_TYPE_RGB[id];
  return rgb ? `rgb(${rgb.join(", ")})` : undefined;
}

export function combatTypeHeaderColor(id: string): string | undefined {
  const rgb = COMBAT_TYPE_RGB[id];
  if (!rgb) return undefined;
  // Mix toward neutral grey before dimming; preserve hue without neon headers.
  const grey = (Math.max(...rgb) + Math.min(...rgb)) / 2;
  return `rgb(${rgb.map((value) => Math.round((value * 0.65 + grey * 0.35) * 0.42)).join(", ")})`;
}

export function tierColor(
  tier: PriorityTier,
  kind: "header" | "background"
): string {
  // Same 70% header / 40% cell opacity as GenshinTools.
  const hex = TIER_COLORS[tier][kind];
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );
  return `rgba(${channels.join(", ")}, ${kind === "header" ? 0.7 : 0.4})`;
}
