import { itemMatchesArchiveFilterScope } from "@/lib/archiveFilters";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";

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

function searchTerms(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function majorVersion(version: string | null): number | null {
  if (version === null) return null;
  const match = /^(\d+)(?:\.\d+)*$/.exec(version.trim());
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
  completedIds: ReadonlySet<number>
): boolean {
  return itemMatchesArchiveFilterScope(
    achievement,
    query,
    (item, normalizedSearch) => {
      const terms = searchTerms(normalizedSearch);
      const text = [item.name, item.description].join("\n").toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    },
    (item) => {
      if (statuses.size > 0) {
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

export function groupAchievementSeries<T extends AchievementArchiveItem>(
  achievements: readonly T[]
): AchievementSeries<T>[] {
  const sorted = [...achievements].sort(
    (left, right) =>
      compareReleaseVersionsDescending(
        left.releaseVersion,
        right.releaseVersion
      ) ||
      right.order - left.order ||
      left.id - right.id
  );
  const groups: { items: T[]; seriesIds: readonly number[] }[] = [];
  let previousKey: string | undefined;

  // A chain can span patches or be interrupted by another achievement's
  // priority. Only join adjacent rows, preserving the displayed release order
  // while retaining the full authoritative chain for completion updates.
  for (const achievement of sorted) {
    const seriesIds = achievement.chainIds;
    const key = seriesIds.join(":");
    const group = groups.at(-1);
    if (group && key === previousKey) group.items.push(achievement);
    else groups.push({ items: [achievement], seriesIds: [...seriesIds] });
    previousKey = key;
  }
  return groups;
}

export function achievementCompletionProgress(
  achievements: readonly Pick<AchievementArchiveItem, "id">[],
  completedIds: ReadonlySet<number>
): { completed: number; total: number; percentage: number } {
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
