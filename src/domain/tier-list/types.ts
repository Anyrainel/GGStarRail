import type {
  PRIORITY_ROWS,
  PRIORITY_TIERS,
  RELIC_PRIORITY_GROUPS,
} from "./constants";

export type RankedPriorityTier = (typeof PRIORITY_TIERS)[number];

export type PriorityTier = (typeof PRIORITY_ROWS)[number];

export type RelicPriorityGroup = (typeof RELIC_PRIORITY_GROUPS)[number];

export interface PriorityPlacement {
  tier: RankedPriorityTier;
  position: number;
}

export interface PriorityAssignments {
  [itemId: string]: PriorityPlacement;
}

export interface RelicGroupAssignments {
  [setId: string]: RelicPriorityGroup;
}
