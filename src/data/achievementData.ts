import type {
  AchievementDisplayData,
  AchievementLogic,
  AchievementText,
} from "./achievementTypes";

export function expandAchievementData(
  logic: AchievementLogic,
  text: AchievementText
): AchievementDisplayData {
  const result: AchievementDisplayData = { categories: [], achievements: [] };
  const ids = new Set<number>();
  for (const category of logic.categories) {
    const name = text.categories[category.id];
    if (!name)
      throw new Error(`Missing achievement category text ${category.id}`);
    result.categories.push({ id: category.id, order: category.order, name });
    for (const group of category.achievements) {
      if (!group.length) throw new Error("Empty achievement display group");
      for (const entry of group) {
        if (ids.has(entry.id))
          throw new Error(`Duplicate achievement ${entry.id}`);
        ids.add(entry.id);
        const localized = text.achievements[entry.id];
        if (!localized?.name || !localized.desc)
          throw new Error(`Missing achievement text ${entry.id}`);
        let description = localized.desc;
        if (typeof description !== "string") {
          const [index, ...params] = description;
          const template = text.descriptionTemplates?.[index];
          if (template === undefined)
            throw new Error(
              `Missing achievement description template ${index}`
            );
          description = template.replace(/\{(\d+)\}/g, (token, position) => {
            const value = params[Number(position)];
            if (value === undefined)
              throw new Error(`Missing achievement parameter ${token}`);
            return String(value);
          });
        }
        result.achievements.push({
          ...entry,
          categoryId: category.id,
          groupIds: group.map((item) => item.id),
          name: localized.name,
          description,
        });
      }
    }
  }
  return result;
}
