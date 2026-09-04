import { Check, CircleHelp, ExternalLink, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  type AchievementArchiveItem,
  type AchievementStatusFilter,
  type AchievementVersionFilter,
  achievementCompletionProgress,
  achievementMatchesFilters,
  achievementPresentedText,
  buildAchievementVideoSearchUrl,
  classifyAchievementCompletion,
  deriveAchievementVersionFilters,
  groupAchievementSeries,
  UNKNOWN_ACHIEVEMENT_VERSION,
} from "@/domain/achievements";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const STATUS_OPTIONS: readonly AchievementStatusFilter[] = [
  "unfinished",
  "finished",
];

export interface AchievementArchiveCategoryView {
  id: number;
  name: string;
  order: number;
}

export interface AchievementArchiveItemView extends AchievementArchiveItem {
  rewardCount: 5 | 10 | 20;
  rewardItemId: number;
}

interface CompletionFilterSnapshot {
  accountIdentity: string | null;
  completedIds: readonly number[] | null;
}

function completionAccountIdentity(
  account: {
    profileId: string;
    source: { importedAt: string };
  } | null
): string | null {
  return account ? `${account.profileId}\0${account.source.importedAt}` : null;
}

function CategoryList({
  categories,
  achievementsByCategory,
  completedIds,
  selectedCategoryId,
  onSelect,
}: {
  categories: readonly AchievementArchiveCategoryView[];
  achievementsByCategory: ReadonlyMap<
    number,
    readonly AchievementArchiveItemView[]
  >;
  completedIds: ReadonlySet<number> | null;
  selectedCategoryId: number | null;
  onSelect: (categoryId: number) => void;
}) {
  const { t } = useI18n();
  if (categories.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("archive.achievement.noResults")}
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-2 md:grid-cols-1">
      {categories.map((category) => {
        const achievements = achievementsByCategory.get(category.id) ?? [];
        const progress = achievementCompletionProgress(
          achievements,
          completedIds
        );
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selectedCategoryId === category.id}
            onClick={() => onSelect(category.id)}
            className={cn(
              "w-full min-w-0 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              selectedCategoryId === category.id
                ? "bg-primary/15 ring-1 ring-primary/30"
                : "hover:bg-secondary/55"
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Trophy
                className="mx-1 h-5 w-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block break-words text-sm font-medium lg:text-base">
                  {category.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress
                    ? `${progress.completed} / ${progress.total}`
                    : t(
                        "archive.achievement.completion.progressUnavailableShort"
                      )}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CompletionCoverageNotice({
  completionState,
}: {
  completionState: ReturnType<typeof classifyAchievementCompletion>;
}) {
  const { t } = useI18n();
  const message = (() => {
    switch (completionState) {
      case "no-account":
        return t("archive.achievement.completion.noAccount");
      case "available-to-track":
        return t("archive.achievement.completion.availableToTrack");
      case "manual":
        return t("archive.achievement.completion.manual");
      case "captured":
        return t("archive.achievement.completion.captured");
      case "captured-edited":
        return t("archive.achievement.completion.capturedEdited");
    }
  })();

  return (
    <div
      className="mb-2 flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs leading-5 text-muted-foreground"
      role="status"
    >
      <CircleHelp
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <p className="min-w-0 break-words">{message}</p>
    </div>
  );
}

function AchievementFilterToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  versionFilter,
  onVersionFilterChange,
  versionOptions,
  completionKnown,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: ReadonlySet<AchievementStatusFilter>;
  onStatusFilterChange: (values: Set<AchievementStatusFilter>) => void;
  versionFilter: ReadonlySet<AchievementVersionFilter>;
  onVersionFilterChange: (values: Set<AchievementVersionFilter>) => void;
  versionOptions: readonly AchievementVersionFilter[];
  completionKnown: boolean;
}) {
  const { t } = useI18n();
  return (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchLabel={t("archive.achievement.searchLabel")}
      searchPlaceholder={t("archive.achievement.searchPlaceholder")}
      filtersLabel={t("archive.achievement.filtersLabel")}
    >
      <FilterChipGroup
        options={STATUS_OPTIONS}
        selectedValues={statusFilter}
        onSelectedValuesChange={onStatusFilterChange}
        getKey={(status) => status}
        getLabel={(status) =>
          t(
            status === "unfinished"
              ? "archive.achievement.status.unfinished"
              : "archive.achievement.status.finished"
          )
        }
        emptyMeansAll={false}
        disabled={!completionKnown}
        className="contents"
      />
      <span
        className="mx-1 hidden h-5 w-px bg-border sm:block"
        aria-hidden="true"
      />
      <FilterChipGroup
        options={versionOptions}
        selectedValues={versionFilter}
        onSelectedValuesChange={onVersionFilterChange}
        getKey={(version) => version}
        getLabel={(version) =>
          version === UNKNOWN_ACHIEVEMENT_VERSION
            ? t("archive.achievement.version.unknown")
            : `v${version}.x`
        }
        emptyMeansAll
        className="contents"
      />
    </ArchiveToolbar>
  );
}

function CategoryProgressBanner({
  category,
  achievements,
  completedIds,
}: {
  category: AchievementArchiveCategoryView;
  achievements: readonly AchievementArchiveItemView[];
  completedIds: ReadonlySet<number> | null;
}) {
  const { t } = useI18n();
  const progress = achievementCompletionProgress(achievements, completedIds);
  return (
    <div className="sticky top-0 z-20 pb-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-primary bg-card px-3 py-2 shadow-sm">
        <h2 className="min-w-0 shrink break-words text-base font-semibold leading-tight sm:text-lg">
          {category.name}
        </h2>
        {progress ? (
          <div className="flex min-w-[12rem] basis-72 flex-1 items-start gap-3">
            <div className="min-w-0 flex-1">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.completed}
                aria-label={t("archive.achievement.progressLabel", {
                  category: category.name,
                  completed: progress.completed,
                  total: progress.total,
                })}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="mt-1 text-center text-xs text-muted-foreground">
                {progress.completed} / {progress.total}
              </div>
            </div>
            <div className="w-14 shrink-0 text-right text-base font-semibold tabular-nums sm:text-lg">
              {progress.percentage}%
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t("archive.achievement.completion.progressUnavailable")}
          </p>
        )}
      </div>
    </div>
  );
}

function GuideLink({
  site,
  achievementName,
}: {
  site: "youtube" | "bilibili";
  achievementName: string;
}) {
  const { locale, t } = useI18n();
  const label = t(
    site === "youtube"
      ? "archive.achievement.searchYouTube"
      : "archive.achievement.searchBilibili",
    { name: achievementName }
  );
  return (
    <a
      href={buildAchievementVideoSearchUrl(site, achievementName, locale)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {site === "youtube" ? "YouTube" : "Bilibili"}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

function AchievementSeriesCard({
  series,
  seriesIds,
  completedIds,
  hasAccount,
  onStatusChange,
}: {
  series: readonly AchievementArchiveItemView[];
  seriesIds: readonly number[];
  completedIds: ReadonlySet<number> | null;
  hasAccount: boolean;
  onStatusChange: (
    seriesIds: readonly number[],
    achievementId: number,
    completed: boolean
  ) => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="min-w-0 overflow-hidden border-border bg-card/60">
      <div className="min-w-0 divide-y divide-border">
        {series.map((achievement) => {
          const completionKnown = completedIds !== null;
          const completed = completionKnown && completedIds.has(achievement.id);
          const presented = achievementPresentedText(achievement, completed);
          const displayedName =
            presented.name ?? t("archive.achievement.concealedName");
          const accessibleName =
            presented.name ??
            t("archive.achievement.concealedAccessibleName", {
              id: achievement.id,
            });
          const displayedDescription =
            presented.description ??
            t("archive.achievement.concealedDescription");
          const toggleLabel = !hasAccount
            ? t("archive.achievement.trackingUnavailable")
            : !completionKnown
              ? t("archive.achievement.startTrackingAndMarkFinished", {
                  name: accessibleName,
                })
              : t(
                  completed
                    ? "archive.achievement.markUnfinished"
                    : "archive.achievement.markFinished",
                  { name: accessibleName }
                );

          return (
            <article
              key={achievement.id}
              className={cn(
                "relative flex min-w-0 items-stretch overflow-hidden bg-card/40 px-2 py-2 before:absolute before:inset-0 before:origin-left before:bg-primary/15 before:transition-transform before:duration-700 sm:px-3",
                completed ? "before:scale-x-100" : "before:scale-x-0"
              )}
              {...(presented.concealed ? { "aria-label": accessibleName } : {})}
            >
              <div className="relative z-10 flex w-10 shrink-0 items-center justify-center sm:w-12">
                <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="relative z-10 min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <h3
                    className={cn(
                      "min-w-0 break-words font-medium leading-tight",
                      completed ? "text-foreground" : "text-foreground/85"
                    )}
                  >
                    {displayedName}
                  </h3>
                  {achievement.releaseVersion ? (
                    <Badge variant="secondary" className="px-1.5 py-0">
                      v{achievement.releaseVersion}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="px-1.5 py-0">
                      {t("archive.achievement.version.unknown")}
                    </Badge>
                  )}
                  {achievement.visibility === "show_after_finish" && (
                    <Badge variant="outline" className="px-1.5 py-0">
                      {t("archive.achievement.visibility.showAfterFinish")}
                    </Badge>
                  )}
                  {achievement.visibility === "hidden_description" && (
                    <Badge variant="outline" className="px-1.5 py-0">
                      {t("archive.achievement.visibility.hiddenDescription")}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 break-words whitespace-pre-line text-sm leading-5 text-muted-foreground">
                  {displayedDescription}
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-1">
                  {!presented.concealed && (
                    <>
                      <GuideLink
                        site="youtube"
                        achievementName={displayedName}
                      />
                      <GuideLink
                        site="bilibili"
                        achievementName={displayedName}
                      />
                    </>
                  )}
                  <span
                    className="mx-1 h-6 w-px shrink-0 bg-border"
                    aria-hidden="true"
                  />
                  <span className="flex h-9 shrink-0 items-center gap-1 px-1 text-sm font-medium tabular-nums">
                    {achievement.rewardCount}
                    <AssetImage
                      kind="achievement-reward"
                      id={String(achievement.rewardItemId)}
                      alt={t("archive.achievement.stellarJade")}
                      className="h-5 w-5 object-contain"
                    />
                  </span>
                  <button
                    type="button"
                    {...(completionKnown ? { "aria-pressed": completed } : {})}
                    aria-label={toggleLabel}
                    title={toggleLabel}
                    disabled={!hasAccount}
                    onClick={() =>
                      onStatusChange(
                        seriesIds,
                        achievement.id,
                        completionKnown ? !completed : true
                      )
                    }
                    className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                        completed
                          ? "border-primary bg-primary text-primary-foreground group-hover:bg-primary/80"
                          : "border-foreground/60 text-foreground group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      {completed && (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

export function AchievementArchiveContent({
  categories: categoryInput,
  achievements: achievementInput,
}: {
  categories: readonly AchievementArchiveCategoryView[];
  achievements: readonly AchievementArchiveItemView[];
}) {
  const { t } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const account = useWorkspaceStore((state) => state.account);
  const setSeriesAchievementStatus = useWorkspaceStore(
    (state) => state.setSeriesAchievementStatus
  );
  const achievementCompletion = account?.achievementCompletion;
  const liveCompletedIds = useMemo(
    () =>
      achievementCompletion
        ? new Set(achievementCompletion.completedIds)
        : null,
    [achievementCompletion]
  );
  const accountIdentity = completionAccountIdentity(account);
  const [filterSnapshot, setFilterSnapshot] =
    useState<CompletionFilterSnapshot>(() => ({
      accountIdentity,
      completedIds: achievementCompletion
        ? [...achievementCompletion.completedIds]
        : null,
    }));
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    Set<AchievementStatusFilter>
  >(() => new Set(["unfinished"]));
  const [versionFilter, setVersionFilter] = useState<
    Set<AchievementVersionFilter>
  >(() => new Set());

  const refreshFilterSnapshot = useCallback(() => {
    setFilterSnapshot({
      accountIdentity,
      completedIds: achievementCompletion
        ? [...achievementCompletion.completedIds]
        : null,
    });
  }, [accountIdentity, achievementCompletion]);

  useEffect(() => {
    if (filterSnapshot.accountIdentity !== accountIdentity) {
      refreshFilterSnapshot();
    }
  }, [accountIdentity, filterSnapshot.accountIdentity, refreshFilterSnapshot]);

  const filterCompletedIds = useMemo(() => {
    if (filterSnapshot.accountIdentity !== accountIdentity) {
      return liveCompletedIds;
    }
    return filterSnapshot.completedIds === null
      ? null
      : new Set(filterSnapshot.completedIds);
  }, [accountIdentity, filterSnapshot, liveCompletedIds]);

  const categories = useMemo(
    () =>
      [...categoryInput].sort(
        (left, right) => right.order - left.order || left.id - right.id
      ),
    [categoryInput]
  );
  const achievementsByCategory = useMemo(() => {
    const result = new Map<number, AchievementArchiveItemView[]>();
    for (const achievement of [...achievementInput].sort(
      (left, right) => right.order - left.order || left.id - right.id
    )) {
      const existing = result.get(achievement.categoryId);
      if (existing) existing.push(achievement);
      else result.set(achievement.categoryId, [achievement]);
    }
    return result;
  }, [achievementInput]);
  const versionOptions = useMemo(
    () => deriveAchievementVersionFilters(achievementInput),
    [achievementInput]
  );

  const matchingAchievementsByCategory = useMemo(() => {
    const result = new Map<number, AchievementArchiveItemView[]>();
    const searchIsActive = searchQuery.trim().length > 0;
    const completionForFiltering = searchIsActive
      ? liveCompletedIds
      : filterCompletedIds;
    for (const [categoryId, achievements] of achievementsByCategory) {
      const matching = achievements.filter((achievement) =>
        achievementMatchesFilters(
          achievement,
          searchQuery,
          statusFilter,
          versionFilter,
          completionForFiltering
        )
      );
      if (matching.length > 0) result.set(categoryId, matching);
    }
    return result;
  }, [
    achievementsByCategory,
    filterCompletedIds,
    liveCompletedIds,
    searchQuery,
    statusFilter,
    versionFilter,
  ]);

  const visibleCategories = useMemo(
    () =>
      categories.filter((category) =>
        matchingAchievementsByCategory.has(category.id)
      ),
    [categories, matchingAchievementsByCategory]
  );

  useEffect(() => {
    if (visibleCategories.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (
      !visibleCategories.some((category) => category.id === selectedCategoryId)
    ) {
      if (isDesktop) setSelectedCategoryId(visibleCategories[0]?.id ?? null);
      else if (selectedCategoryId !== null) setSelectedCategoryId(null);
    }
  }, [isDesktop, selectedCategoryId, visibleCategories]);

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId
  );
  const visibleSeries = useMemo(() => {
    if (selectedCategoryId === null) return [];
    const matchingIds = new Set(
      (matchingAchievementsByCategory.get(selectedCategoryId) ?? []).map(
        (achievement) => achievement.id
      )
    );
    return groupAchievementSeries(
      achievementsByCategory.get(selectedCategoryId) ?? []
    ).flatMap(({ items, seriesIds }) => {
      const matching = items.filter((achievement) =>
        matchingIds.has(achievement.id)
      );
      return matching.length > 0 ? [{ series: matching, seriesIds }] : [];
    });
  }, [
    achievementsByCategory,
    matchingAchievementsByCategory,
    selectedCategoryId,
  ]);

  const handleCategorySelect = useCallback(
    (categoryId: number) => {
      refreshFilterSnapshot();
      setSelectedCategoryId(categoryId);
    },
    [refreshFilterSnapshot]
  );
  const handleStatusFilterChange = useCallback(
    (values: Set<AchievementStatusFilter>) => {
      refreshFilterSnapshot();
      setStatusFilter(values);
    },
    [refreshFilterSnapshot]
  );
  const handleVersionFilterChange = useCallback(
    (values: Set<AchievementVersionFilter>) => {
      refreshFilterSnapshot();
      setVersionFilter(values);
    },
    [refreshFilterSnapshot]
  );
  const handleStatusChange = useCallback(
    (
      seriesIds: readonly number[],
      achievementId: number,
      completed: boolean
    ) => {
      setSeriesAchievementStatus(seriesIds, achievementId, completed);
    },
    [setSeriesAchievementStatus]
  );

  const completionState = classifyAchievementCompletion(
    account !== null,
    achievementCompletion
  );
  const categoryList = (
    <CategoryList
      categories={visibleCategories}
      achievementsByCategory={achievementsByCategory}
      completedIds={liveCompletedIds}
      selectedCategoryId={selectedCategoryId}
      onSelect={handleCategorySelect}
    />
  );
  const toolbar = (
    <AchievementFilterToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      versionFilter={versionFilter}
      onVersionFilterChange={handleVersionFilterChange}
      versionOptions={versionOptions}
      completionKnown={achievementCompletion !== undefined}
    />
  );

  return (
    <SidebarDetailLayout
      header={toolbar}
      sidebar={categoryList}
      mobileGrid={categoryList}
      hasSelection={selectedCategoryId !== null}
      onBack={() => setSelectedCategoryId(null)}
      backLabel={t("archive.achievement.categories")}
      sidebarLabel={t("archive.achievement.categoryList")}
      detailLabel={t("archive.achievement.detail")}
      sidebarWidth="w-1/3 max-w-[18rem]"
      banner={<CompletionCoverageNotice completionState={completionState} />}
    >
      {selectedCategory ? (
        <div className="min-w-0 pb-4">
          {!isDesktop && <div className="pb-1">{toolbar}</div>}
          <CategoryProgressBanner
            category={selectedCategory}
            achievements={achievementsByCategory.get(selectedCategory.id) ?? []}
            completedIds={liveCompletedIds}
          />
          {visibleSeries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("archive.achievement.noResults")}
            </p>
          ) : (
            <div className="min-w-0 space-y-1.5">
              {visibleSeries.map(({ series, seriesIds }) => (
                <AchievementSeriesCard
                  key={seriesIds.join(":")}
                  series={series}
                  seriesIds={seriesIds}
                  completedIds={liveCompletedIds}
                  hasAccount={account !== null}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </SidebarDetailLayout>
  );
}
