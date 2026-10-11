import {
  BookMarked,
  Check,
  Circle,
  CircleHelp,
  Gem,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadQuestArchive } from "@/data/questLoader";
import type { QuestCategory, QuestDefinition } from "@/data/questTypes";
import type { QuestProgressRecord } from "@/domain/account/schemas";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";

const CATEGORY_LABELS: Record<QuestCategory, MessageKey> = {
  daily: "archive.quest.daily",
  battle_pass: "archive.quest.battlePass",
  activity: "archive.quest.activity",
  repeatable: "archive.quest.repeatable",
  progression: "archive.quest.progression",
  other: "archive.quest.other",
};
const CATEGORIES = ["activity", "progression", "other"] as const;
type StatusFilter =
  | "all"
  | "finished"
  | "unfinished"
  | "removed"
  | "unobserved";

function isFinished(record: QuestProgressRecord | undefined) {
  return record?.status === 2 || record?.status === 3;
}

export function QuestArchiveContent({
  quests,
  achievementIds,
}: {
  quests: readonly QuestDefinition[];
  achievementIds: ReadonlySet<number>;
}) {
  const { t, locale } = useI18n();
  const snapshot = useWorkspaceStore((state) => state.account?.questProgress);
  const [category, setCategory] = useState<QuestCategory | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const records = useMemo(
    () => new Map(snapshot?.records.map((record) => [record.id, record]) ?? []),
    [snapshot]
  );
  const entries = useMemo(() => {
    const known = new Set(quests.map((quest) => quest.id));
    const unknown: QuestDefinition[] = (snapshot?.records ?? [])
      .filter(
        (record) => !known.has(record.id) && !achievementIds.has(record.id)
      )
      .map((record) => ({
        id: record.id,
        is_periodic: false,
        category: "other",
        name: null,
        quest_type: 0,
        title_parameters: [],
        condition: null,
        reward_id: 0,
        rewards: [],
        unlock_type: "",
        unlock_parameters: [],
        activity_module_id: null,
        cycle_days: null,
        schedule_id: null,
        chain_ids: [],
      }));
    return [...quests.filter((quest) => !quest.is_periodic), ...unknown];
  }, [quests, snapshot, achievementIds]);
  const title = (quest: QuestDefinition) =>
    quest.name
      ? formatGameText(
          quest.name[locale].value,
          quest.title_parameters,
          t("archive.quest.trailblazer")
        )
      : t("archive.quest.untitled", { id: quest.id });
  const matching = entries.filter((quest) => {
    const record = records.get(quest.id);
    const needle = search.trim().toLocaleLowerCase();
    return (
      (!needle ||
        `${quest.id} ${title(quest)} ${quest.condition?.finish_type ?? ""}`
          .toLocaleLowerCase()
          .includes(needle)) &&
      (needle ||
        status === "all" ||
        (status === "finished" && isFinished(record)) ||
        (status === "unfinished" &&
          record !== undefined &&
          record.status !== 4 &&
          !isFinished(record)) ||
        (status === "removed" && record?.status === 4) ||
        (status === "unobserved" && !record))
    );
  });
  const visible = matching.filter(
    (quest) =>
      search.trim() !== "" || category === null || quest.category === category
  );
  const completed = visible.filter((quest) =>
    isFinished(records.get(quest.id))
  ).length;
  const changeFilters = (change: () => void) => {
    change();
    setPage(1);
  };
  const toolbar = (
    <ArchiveToolbar
      searchQuery={search}
      onSearchChange={(value) => changeFilters(() => setSearch(value))}
      searchLabel={t("archive.quest.search")}
      searchPlaceholder={t("archive.quest.search")}
      filtersLabel={t("archive.quest.filtersLabel")}
    >
      <div className="flex flex-wrap gap-1.5">
        {(
          ["all", "finished", "unfinished", "removed", "unobserved"] as const
        ).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "secondary" : "ghost"}
            aria-pressed={status === value}
            onClick={() => changeFilters(() => setStatus(value))}
          >
            {t(
              value === "all"
                ? "archive.quest.all"
                : value === "finished"
                  ? "archive.achievement.status.finished"
                  : value === "unfinished"
                    ? "archive.achievement.status.unfinished"
                    : value === "removed"
                      ? "archive.quest.removed"
                      : "archive.quest.unobserved"
            )}
          </Button>
        ))}
      </div>
    </ArchiveToolbar>
  );
  const sidebar = (
    <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-1">
      {([null, ...CATEGORIES] as const).map((value) => {
        const group = matching.filter(
          (quest) => value === null || quest.category === value
        );
        const count = group.filter((quest) =>
          isFinished(records.get(quest.id))
        ).length;
        return (
          <button
            key={value ?? "all"}
            type="button"
            aria-pressed={category === value}
            onClick={() => changeFilters(() => setCategory(value))}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              category === value
                ? "bg-primary/15 ring-1 ring-primary/30"
                : "hover:bg-secondary/55"
            )}
          >
            <BookMarked
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {t(
                  value === null ? "archive.quest.all" : CATEGORY_LABELS[value]
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {snapshot ? `${count} / ${group.length}` : group.length}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
  return (
    <SidebarDetailLayout
      header={toolbar}
      mobileDetailHeader={toolbar}
      sidebar={sidebar}
      hasSelection={category !== null}
      onBack={() => changeFilters(() => setCategory(null))}
      backLabel={t("nav.archiveQuests")}
      sidebarLabel={t("archive.quest.categories")}
      detailLabel={t("route.archiveQuests.title")}
      mobileGrid={
        <div className="space-y-3">
          {sidebar}
          <div className="px-1">{renderList()}</div>
        </div>
      }
    >
      {renderList()}
    </SidebarDetailLayout>
  );

  function renderList() {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" aria-hidden="true" />
            {t(
              category && !search.trim()
                ? CATEGORY_LABELS[category]
                : "route.archiveQuests.title"
            )}
          </h2>
          <span className="text-sm text-muted-foreground">
            {snapshot
              ? `${completed} / ${visible.length}`
              : t("archive.quest.count", { count: visible.length })}
          </span>
        </div>
        {visible.length === 0 ? (
          <CatalogEmpty />
        ) : (
          visible.slice(0, page * 60).map((quest) => {
            const record = records.get(quest.id);
            const finished = isFinished(record);
            const StatusIcon = !record ? CircleHelp : finished ? Check : Circle;
            return (
              <Card key={quest.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <StatusIcon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      finished ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-medium">{title(quest)}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>#{quest.id}</span>
                      <span>{t(CATEGORY_LABELS[quest.category])}</span>
                      <span>
                        {t(
                          !record
                            ? "archive.quest.unobserved"
                            : record.status === 4
                              ? "archive.quest.removed"
                              : finished
                                ? "archive.achievement.status.finished"
                                : "archive.achievement.status.unfinished"
                        )}
                      </span>
                    </div>
                  </div>
                  {record && (
                    <Badge variant="secondary">
                      {record.progress}
                      {quest.condition && quest.condition.progress > 0
                        ? ` / ${quest.condition.progress}`
                        : ""}
                    </Badge>
                  )}
                </div>
                {quest.rewards.length > 0 && (
                  <div className="flex flex-wrap gap-3 pl-8 text-sm">
                    {quest.rewards.map((reward) => (
                      <span
                        key={reward.item_id}
                        className="inline-flex items-center gap-1.5"
                      >
                        {reward.item_id === 1 && (
                          <Gem
                            className="h-3.5 w-3.5 text-primary"
                            aria-hidden="true"
                          />
                        )}
                        {reward.name?.[locale].value ??
                          t("archive.quest.item", { id: reward.item_id })}
                        <span className="tabular-nums text-muted-foreground">
                          × {reward.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <details className="pl-8 text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    {t("archive.quest.details")}
                  </summary>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 break-words">
                    <dt>{t("archive.quest.condition")}</dt>
                    <dd>
                      {quest.condition?.finish_type ??
                        t("archive.quest.unavailable")}
                    </dd>
                    {quest.condition && (
                      <>
                        <dt>{t("archive.quest.parameters")}</dt>
                        <dd>
                          {[
                            ...quest.condition.parameters,
                            ...quest.condition.parameter_integers,
                          ].join(", ") || "—"}
                        </dd>
                      </>
                    )}
                    {record && (
                      <>
                        <dt>{t("archive.quest.status")}</dt>
                        <dd>{record.status}</dd>
                        {record.counters.length > 0 && (
                          <>
                            <dt>{t("archive.quest.counters")}</dt>
                            <dd>{record.counters.join(" / ")}</dd>
                          </>
                        )}
                      </>
                    )}
                    {quest.cycle_days !== null && (
                      <>
                        <dt>{t("archive.quest.cycle")}</dt>
                        <dd>
                          {t("archive.quest.days", { count: quest.cycle_days })}
                        </dd>
                      </>
                    )}
                    {quest.unlock_parameters.length > 0 && (
                      <>
                        <dt>{t("archive.quest.unlock")}</dt>
                        <dd>{quest.unlock_parameters.join(", ")}</dd>
                      </>
                    )}
                  </dl>
                </details>
              </Card>
            );
          })
        )}
        {visible.length > page * 60 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPage((value) => value + 1)}
          >
            {t("archive.quest.more")}
          </Button>
        )}
      </div>
    );
  }
}

export function QuestArchiveView() {
  const resource = useCatalogResource(loadQuestArchive);
  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return <CatalogEmpty />;
  return <QuestArchiveContent {...resource.data} />;
}
