import type { ReferenceLocale } from "@/domain/provenance";
import { expandAchievementData } from "./achievementData";
import type { AchievementLogic, AchievementText } from "./achievementTypes";
import { betaEnabled } from "./betaState";

const urls = import.meta.glob<string>(
  ["./game/achievements*.json", "./game/achievements*.json.gz"],
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);
const pending = new Map<string, Promise<unknown>>();

function load<T>(part: "logic" | "en" | "zh", beta: boolean): Promise<T> {
  const file = `achievements${beta ? "_beta" : ""}${part === "logic" ? "" : `_${part}`}.json${beta ? ".gz" : ""}`;
  let promise = pending.get(file);
  if (!promise) {
    promise = (async () => {
      const url = urls[`./game/${file}`];
      if (!url) throw new Error(`Missing achievement transport ${file}`);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `Achievement request failed: ${file} (${response.status})`
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text =
        bytes[0] === 0x1f && bytes[1] === 0x8b
          ? await new Response(
              new Response(bytes).body!.pipeThrough(
                new DecompressionStream("gzip")
              )
            ).text()
          : new TextDecoder().decode(bytes);
      return JSON.parse(text) as unknown;
    })().catch((error: unknown) => {
      pending.delete(file);
      throw error;
    });
    pending.set(file, promise);
  }
  return promise as Promise<T>;
}

export async function loadAchievementLogic(): Promise<AchievementLogic> {
  const [released, beta] = await Promise.all([
    load<AchievementLogic>("logic", false),
    betaEnabled() ? load<AchievementLogic>("logic", true) : undefined,
  ]);
  if (!beta) return released;
  const categories = new Map(
    released.categories.map((category) => [
      category.id,
      { ...category, achievements: [...category.achievements] },
    ])
  );
  for (const category of beta.categories) {
    const existing = categories.get(category.id);
    if (existing) existing.achievements.push(...category.achievements);
    else categories.set(category.id, category);
  }
  return { categories: [...categories.values()] };
}

export async function loadAchievementDisplay(locale: ReferenceLocale) {
  const language = locale === "zh-CN" ? "zh" : "en";
  const [logic, text, betaText] = await Promise.all([
    loadAchievementLogic(),
    load<AchievementText>(language, false),
    betaEnabled() ? load<AchievementText>(language, true) : undefined,
  ]);
  // Expand each channel separately: template indexes are local to its text file.
  if (!betaText) return expandAchievementData(logic, text);
  const [releasedLogic, betaLogic] = await Promise.all([
    load<AchievementLogic>("logic", false),
    load<AchievementLogic>("logic", true),
  ]);
  const released = expandAchievementData(releasedLogic, text);
  const beta = expandAchievementData(betaLogic, betaText);
  const categories = new Map(
    released.categories.map((category) => [category.id, category])
  );
  for (const category of beta.categories)
    if (!categories.has(category.id)) categories.set(category.id, category);
  return {
    categories: [...categories.values()],
    achievements: [...released.achievements, ...beta.achievements],
  };
}
