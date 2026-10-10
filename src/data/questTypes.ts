import type { LocalizedText } from "@/providers/reference/types";

export type QuestCategory =
  | "daily"
  | "battle_pass"
  | "activity"
  | "repeatable"
  | "progression"
  | "other";

export interface QuestDefinition {
  id: number;
  quest_type: number;
  category: QuestCategory;
  name: LocalizedText | null;
  title_parameters: number[];
  condition: {
    id: number;
    finish_type: string | null;
    parameter_type: string;
    parameters: number[];
    parameter_integers: number[];
    parameter_string: string;
    progress: number;
  } | null;
  reward_id: number;
  rewards: { item_id: number; count: number; name: LocalizedText | null }[];
  unlock_type: string;
  unlock_parameters: number[];
  activity_module_id: number | null;
  cycle_days: number | null;
  schedule_id: number | null;
  chain_ids: number[];
}
