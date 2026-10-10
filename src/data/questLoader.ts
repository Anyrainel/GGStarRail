import { loadAchievementIds } from "@/providers/reference/catalog";
import { loadGameMember } from "./gameDataLoader";
import type { QuestDefinition } from "./questTypes";

export async function loadQuestArchive() {
  const [raw, achievementIds] = await Promise.all([
    loadGameMember("quests"),
    loadAchievementIds(),
  ]);
  const document = raw as { collection: string; value: QuestDefinition[] };
  if (document.collection !== "quests" || !Array.isArray(document.value))
    throw new Error("Invalid Quest catalog");
  return { quests: document.value, achievementIds };
}
