export const PRIORITY_TIERS = ["S", "A", "B", "C", "D"] as const;

export const PRIORITY_ROWS = [...PRIORITY_TIERS, "Pool"] as const;

export const RELIC_PRIORITY_GROUPS = ["dps", "support", "other"] as const;
