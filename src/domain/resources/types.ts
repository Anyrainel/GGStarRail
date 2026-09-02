import type {
  AccountSnapshot,
  RelicCategory,
  RelicSlot,
} from "@/domain/account/schemas";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import type { RelicScoringContext } from "@/domain/build/scoring";
import type {
  ResourceActionKind,
  ResourceSettings,
  ResourceSuggestionPriority,
} from "./schemas";

export interface ResourceRelicDefinition {
  id: string;
  setId: string;
  slot: RelicSlot;
  rarity: number;
  maxLevel: number;
}

export interface ResourceRecommendationInput {
  account: AccountSnapshot;
  builds: readonly BuildConfiguration[];
  scoreProfiles: readonly ScoreProfile[];
  scoringContext: RelicScoringContext;
  relicDefinitions: readonly ResourceRelicDefinition[];
  settings: ResourceSettings;
}

interface ResourceSuggestionBase {
  id: string;
  kind: ResourceActionKind;
  priority: ResourceSuggestionPriority;
  buildId: string;
  characterDefinitionId: string;
  setId: string;
  targetDefinitionId: string;
  slot: RelicSlot;
  category: RelicCategory;
  mainStatId: string;
  currentScore: number | null;
  opportunityScore: number;
}

export interface LevelRelicSuggestion extends ResourceSuggestionBase {
  kind: "level-up";
  relicKey: string;
  currentLevel: number;
  targetLevel: number;
  optimisticScore: number;
}

export interface SynthesizeRelicSuggestion extends ResourceSuggestionBase {
  kind: "synthesize";
  relicRemains: 100;
  selfModelingResin: 0 | 1;
}

export interface RerollRelicSuggestion extends ResourceSuggestionBase {
  kind: "reroll";
  relicKey: string;
  targetLevel: number;
  optimisticScore: number;
  variableDice: 1;
}

export type ResourceSuggestion =
  | LevelRelicSuggestion
  | SynthesizeRelicSuggestion
  | RerollRelicSuggestion;
