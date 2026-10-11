import type { COMBAT_TYPE_RGB } from "@/config/gameColors";
import type { PriorityTier } from "@/domain/tier-list/types";

// Full literal class names are scanned by Tailwind; never interpolate a token.
const COMBAT_CLASSES = {
  Physical: {
    text: "text-combat-physical",
    header: "bg-combat-physical-header",
  },
  Fire: { text: "text-combat-fire", header: "bg-combat-fire-header" },
  Ice: { text: "text-combat-ice", header: "bg-combat-ice-header" },
  Thunder: { text: "text-combat-thunder", header: "bg-combat-thunder-header" },
  Wind: { text: "text-combat-wind", header: "bg-combat-wind-header" },
  Quantum: { text: "text-combat-quantum", header: "bg-combat-quantum-header" },
  Imaginary: {
    text: "text-combat-imaginary",
    header: "bg-combat-imaginary-header",
  },
} as const satisfies Record<
  keyof typeof COMBAT_TYPE_RGB,
  Record<"text" | "header", string>
>;

export function getCombatTypeColor(
  id: string,
  kind: "text" | "header"
): string {
  // Catalog group IDs also include Paths: these keep the existing neutral header.
  return Object.hasOwn(COMBAT_CLASSES, id)
    ? COMBAT_CLASSES[id as keyof typeof COMBAT_CLASSES][kind]
    : "";
}

const TIER_CLASSES = {
  S: { header: "bg-tier-s/70", bg: "bg-tier-s-background/40" },
  A: { header: "bg-tier-a/70", bg: "bg-tier-a-background/40" },
  B: { header: "bg-tier-b/70", bg: "bg-tier-b-background/40" },
  C: { header: "bg-tier-c/70", bg: "bg-tier-c-background/40" },
  D: { header: "bg-tier-d/70", bg: "bg-tier-d-background/40" },
  Pool: { header: "bg-tier-pool/70", bg: "bg-tier-pool-background/40" },
} as const satisfies Record<PriorityTier, Record<"header" | "bg", string>>;

export function getTierColor(
  tier: PriorityTier,
  kind: "header" | "bg"
): string {
  return TIER_CLASSES[tier][kind];
}

const RARITY_CLASSES = {
  1: {
    bg: "bg-rarity-1",
    text: "text-rarity-1-foreground",
    border: "border-rarity-1",
    gradient: "bg-rarity-gradient-1",
  },
  2: {
    bg: "bg-rarity-2",
    text: "text-rarity-2-foreground",
    border: "border-rarity-2",
    gradient: "bg-rarity-gradient-2",
  },
  3: {
    bg: "bg-rarity-3",
    text: "text-rarity-3-foreground",
    border: "border-rarity-3",
    gradient: "bg-rarity-gradient-3",
  },
  4: {
    bg: "bg-rarity-4",
    text: "text-rarity-4-foreground",
    border: "border-rarity-4",
    gradient: "bg-rarity-gradient-4",
  },
  5: {
    bg: "bg-rarity-5",
    text: "text-rarity-5-foreground",
    border: "border-rarity-5",
    gradient: "bg-rarity-gradient-5",
  },
} as const;

export function getRarityColor(
  rarity: number | null,
  kind: "bg" | "text" | "border" | "gradient"
): string {
  if (rarity === null)
    return kind === "gradient" ? "bg-rarity-gradient-neutral" : "";
  // Match the existing icon fallback for unrecognized rarity.
  const key = Object.hasOwn(RARITY_CLASSES, rarity)
    ? (rarity as keyof typeof RARITY_CLASSES)
    : 1;
  return RARITY_CLASSES[key][kind];
}
