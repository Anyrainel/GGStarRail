import { itemMatchesArchiveFilterScope } from "@/lib/archiveFilters";

export const UNKNOWN_ACHIEVEMENT_VERSION = "unknown";

export type AchievementStatusFilter = "unfinished" | "finished";
export type AchievementVersionFilter =
  | typeof UNKNOWN_ACHIEVEMENT_VERSION
  | `${number}`;
export type AchievementVisibility =
  | "visible"
  | "show_after_finish"
  | "hidden_description";

export interface AchievementArchiveItem {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  hiddenDescription: string | null;
  order: number;
  releaseVersion: string | null;
  visibility: AchievementVisibility;
  chainIds: readonly number[];
  chainIndex: number;
}

export interface AchievementSeries<T extends AchievementArchiveItem> {
  items: readonly T[];
  seriesIds: readonly number[];
}

export interface AchievementCompletionLike {
  completedIds: readonly number[];
  capture?: unknown;
  locallyModifiedAt?: string;
}

export type AchievementCompletionState =
  | "no-account"
  | "available-to-track"
  | "manual"
  | "captured"
  | "captured-edited";

export interface AchievementPresentedText {
  name: string | null;
  description: string | null;
  concealed: boolean;
  descriptionSource: "normal" | "hidden" | "concealed";
}

function searchTerms(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function majorVersion(version: string | null): number | null {
  if (version === null) return null;
  const match = /^(\d+)(?:\.|$)/.exec(version.trim());
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function achievementVersionFilterValue(
  version: string | null
): AchievementVersionFilter {
  const major = majorVersion(version);
  return major === null
    ? UNKNOWN_ACHIEVEMENT_VERSION
    : (`${major}` as `${number}`);
}

export function deriveAchievementVersionFilters(
  achievements: readonly Pick<AchievementArchiveItem, "releaseVersion">[]
): AchievementVersionFilter[] {
  const known = new Set<number>();
  let includesUnknown = false;

  for (const achievement of achievements) {
    const major = majorVersion(achievement.releaseVersion);
    if (major === null) includesUnknown = true;
    else known.add(major);
  }

  const values: AchievementVersionFilter[] = [...known]
    .sort((left, right) => left - right)
    .map((value) => `${value}` as `${number}`);
  if (includesUnknown) values.push(UNKNOWN_ACHIEVEMENT_VERSION);
  return values;
}

export function achievementMatchesFilters(
  achievement: AchievementArchiveItem,
  query: string,
  statuses: ReadonlySet<AchievementStatusFilter>,
  versions: ReadonlySet<AchievementVersionFilter>,
  completedIds: ReadonlySet<number> | null
): boolean {
  return itemMatchesArchiveFilterScope(
    achievement,
    query,
    (item, normalizedSearch) => {
      const terms = searchTerms(normalizedSearch);
      const presented = achievementPresentedText(
        item,
        completedIds?.has(item.id) ?? false
      );
      const text = [presented.name ?? "", presented.description ?? ""]
        .join("\n")
        .toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    },
    (item) => {
      if (completedIds !== null && statuses.size > 0) {
        const status = completedIds.has(item.id) ? "finished" : "unfinished";
        if (!statuses.has(status)) return false;
      }

      return (
        versions.size === 0 ||
        versions.has(achievementVersionFilterValue(item.releaseVersion))
      );
    }
  );
}

export function achievementPresentedText(
  achievement: Pick<
    AchievementArchiveItem,
    "name" | "description" | "hiddenDescription" | "visibility"
  >,
  completed: boolean
): AchievementPresentedText {
  if (completed || achievement.visibility === "visible") {
    return {
      name: achievement.name,
      description: achievement.description,
      concealed: false,
      descriptionSource: "normal",
    };
  }
  if (achievement.visibility === "show_after_finish") {
    return {
      name: null,
      description: null,
      concealed: true,
      descriptionSource: "concealed",
    };
  }
  return {
    name: achievement.name,
    description: achievement.hiddenDescription,
    concealed: false,
    descriptionSource: "hidden",
  };
}

export function groupAchievementSeries<T extends AchievementArchiveItem>(
  achievements: readonly T[]
): AchievementSeries<T>[] {
  const groups = new Map<
    string,
    { items: T[]; seriesIds: readonly number[] }
  >();

  for (const achievement of achievements) {
    const seriesIds = achievement.chainIds;
    const key = seriesIds.join(":");
    const group = groups.get(key);
    if (group) group.items.push(achievement);
    else groups.set(key, { items: [achievement], seriesIds });
  }

  return [...groups.values()].map(({ items, seriesIds }) => ({
    items: items.sort(
      (left, right) =>
        left.chainIndex - right.chainIndex ||
        right.order - left.order ||
        left.id - right.id
    ),
    seriesIds: [...seriesIds],
  }));
}

export function classifyAchievementCompletion(
  hasAccount: boolean,
  completion: AchievementCompletionLike | undefined
): AchievementCompletionState {
  if (!hasAccount) return "no-account";
  if (!completion) return "available-to-track";
  if (completion.capture && completion.locallyModifiedAt) {
    return "captured-edited";
  }
  if (completion.capture) return "captured";
  return "manual";
}

export function achievementCompletionProgress(
  achievements: readonly Pick<AchievementArchiveItem, "id">[],
  completedIds: ReadonlySet<number> | null
): { completed: number; total: number; percentage: number } | null {
  if (completedIds === null) return null;
  const completed = achievements.reduce(
    (count, achievement) => count + Number(completedIds.has(achievement.id)),
    0
  );
  const total = achievements.length;
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function buildAchievementVideoSearchUrl(
  site: "youtube" | "bilibili",
  achievementName: string,
  locale: "en" | "zh-CN"
): string {
  const gameName = locale === "zh-CN" ? "崩坏：星穹铁道" : "Honkai: Star Rail";
  const query = encodeURIComponent(`${achievementName} ${gameName}`);
  return site === "youtube"
    ? `https://www.youtube.com/results?search_query=${query}`
    : `https://search.bilibili.com/all?keyword=${query}`;
}
