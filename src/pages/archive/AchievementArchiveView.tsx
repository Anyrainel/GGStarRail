import { useCallback, useMemo } from "react";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/game/text";
import { loadAchievementDisplay } from "@/providers/reference/achievementLoader";
import type { AchievementDisplayData } from "@/providers/reference/achievementTypes";
import { loadCatalogAssetLookup } from "@/providers/reference/assets";
import {
  type AchievementArchiveCategoryView,
  AchievementArchiveContent,
  type AchievementArchiveItemView,
} from "./AchievementArchiveContent";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";

const DYNAMIC_TEXT_TOKEN = /\{TEXTJOIN#\d+\}/g;

interface FormattedAchievementText {
  value: string;
  hasDynamicText: boolean;
}

export interface AchievementArchiveViewData {
  categories: readonly AchievementArchiveCategoryView[];
  achievements: readonly AchievementArchiveItemView[];
}

export function formatAchievementArchiveText(
  source: string,
  parameters: readonly number[],
  dynamicTextFallback: string,
  trailblazerFallback: string
): FormattedAchievementText {
  let hasDynamicText = false;
  const formatted = formatGameText(
    source,
    parameters,
    trailblazerFallback
  ).replace(DYNAMIC_TEXT_TOKEN, () => {
    hasDynamicText = true;
    return dynamicTextFallback;
  });
  return { value: formatted, hasDynamicText };
}

export function createAchievementArchiveViewData(
  data: AchievementDisplayData,
  dynamicTextFallback: string,
  trailblazerFallback: string
): AchievementArchiveViewData {
  const format = (text: string) =>
    formatAchievementArchiveText(
      text,
      [],
      dynamicTextFallback,
      trailblazerFallback
    ).value;
  return {
    categories: data.categories.map((category) => ({
      ...category,
      name: format(category.name),
    })),
    achievements: data.achievements.map((entry) => ({
      id: entry.id,
      categoryId: entry.categoryId,
      order: entry.order,
      name: format(entry.name),
      description: format(entry.description),
      releaseVersion: entry.version ?? null,
      groupIds: entry.groupIds,
      rewardCount: entry.reward,
      rewardItemId: 1,
    })),
  };
}

export function AchievementArchiveView() {
  const { locale, t } = useI18n();
  // The asset lookup resolves the Stellar Jade reward icon on first paint.
  const loader = useCallback(
    () =>
      Promise.all([
        loadAchievementDisplay(locale),
        loadCatalogAssetLookup(),
      ]).then(([display]) => display),
    [locale]
  );
  const resource = useCatalogResource(loader);
  const viewData = useMemo(
    () =>
      resource.data
        ? createAchievementArchiveViewData(
            resource.data,
            t("archive.achievement.dynamicTextFallback"),
            t("terms.trailblazer")
          )
        : null,
    [resource.data, t]
  );

  if (resource.loading || resource.error || !viewData) {
    return (
      <div className="container">
        {resource.loading ? (
          <CatalogLoading />
        ) : resource.error ? (
          <CatalogFailure error={resource.error} />
        ) : (
          <CatalogEmpty />
        )}
      </div>
    );
  }
  return (
    <AchievementArchiveContent
      categories={viewData.categories}
      achievements={viewData.achievements}
    />
  );
}
