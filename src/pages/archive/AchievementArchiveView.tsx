import { useMemo } from "react";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import {
  getLocalizedValue,
  loadAchievementCategories,
  loadAchievements,
} from "@/providers/gilore/catalog";
import type {
  AchievementCategoryDefinition,
  AchievementDefinition,
  ReferenceLocale,
} from "@/providers/gilore/types";
import {
  type AchievementArchiveCategoryView,
  AchievementArchiveContent,
  type AchievementArchiveItemView,
} from "./AchievementArchiveContent";
import {
  CatalogEmpty,
  CatalogFailure,
  CatalogLoading,
} from "./CatalogControls";

const DYNAMIC_TEXT_TOKEN = /\{TEXTJOIN#\d+\}/g;

interface FormattedAchievementText {
  value: string;
  hasDynamicText: boolean;
}

export interface AchievementArchiveViewData {
  categories: readonly AchievementArchiveCategoryView[];
  achievements: readonly AchievementArchiveItemView[];
}

async function loadAchievementArchiveData() {
  const [categories, achievements] = await Promise.all([
    loadAchievementCategories(),
    loadAchievements(),
  ]);
  return { categories, achievements };
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

function formatLocalizedText(
  source: AchievementDefinition["name"],
  locale: ReferenceLocale,
  parameters: readonly number[],
  dynamicTextFallback: string,
  trailblazerFallback: string
): FormattedAchievementText {
  return formatAchievementArchiveText(
    getLocalizedValue(source, locale),
    parameters,
    dynamicTextFallback,
    trailblazerFallback
  );
}

export function createAchievementArchiveViewData(
  categories: readonly AchievementCategoryDefinition[],
  achievements: readonly AchievementDefinition[],
  locale: ReferenceLocale,
  dynamicTextFallback: string,
  trailblazerFallback: string
): AchievementArchiveViewData {
  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: formatAchievementArchiveText(
        getLocalizedValue(category.name, locale),
        [],
        dynamicTextFallback,
        trailblazerFallback
      ).value,
      order: category.order,
    })),
    achievements: achievements.map((achievement) => {
      const name = formatLocalizedText(
        achievement.name,
        locale,
        [],
        dynamicTextFallback,
        trailblazerFallback
      );
      const description = formatLocalizedText(
        achievement.description,
        locale,
        achievement.description_parameters,
        dynamicTextFallback,
        trailblazerFallback
      );
      const hiddenDescription = achievement.hidden_description
        ? formatLocalizedText(
            achievement.hidden_description,
            locale,
            achievement.description_parameters,
            dynamicTextFallback,
            trailblazerFallback
          )
        : null;
      return {
        id: achievement.id,
        categoryId: achievement.category_id,
        name: name.value,
        description: description.value,
        hiddenDescription: hiddenDescription?.value ?? null,
        order: achievement.order,
        releaseVersion: achievement.release_version,
        visibility: achievement.visibility,
        chainIds: achievement.chain_ids,
        chainIndex: achievement.chain_index,
        rewardCount: achievement.reward.count,
        rewardItemId: achievement.reward.item_id,
      };
    }),
  };
}

export function AchievementArchiveView() {
  const { locale, t } = useI18n();
  const resource = useCatalogResource(loadAchievementArchiveData);
  const viewData = useMemo(
    () =>
      resource.data
        ? createAchievementArchiveViewData(
            resource.data.categories.values,
            resource.data.achievements.values,
            locale,
            t("archive.achievement.dynamicTextFallback"),
            t("terms.trailblazer")
          )
        : null,
    [locale, resource.data, t]
  );

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!viewData) return <CatalogEmpty />;
  return (
    <AchievementArchiveContent
      categories={viewData.categories}
      achievements={viewData.achievements}
    />
  );
}
