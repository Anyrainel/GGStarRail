import type { Relic } from "@/domain/account/schemas";
import type { ScoreProfile } from "./schemas";

export interface RelicScore {
  total: number;
  contributions: Record<string, number>;
}

export function scoreRelic(relic: Relic, profile: ScoreProfile): RelicScore {
  const stats = profile.includeMainStat
    ? [relic.mainStat, ...relic.substats]
    : relic.substats;
  const contributions: Record<string, number> = {};

  for (const stat of stats) {
    const contribution = stat.value * (profile.statWeights[stat.statId] ?? 0);
    contributions[stat.statId] =
      (contributions[stat.statId] ?? 0) + contribution;
  }

  const total = Object.values(contributions).reduce(
    (sum, contribution) => sum + contribution,
    0
  );

  return { total, contributions };
}
