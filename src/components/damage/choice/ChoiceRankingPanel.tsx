import { Hourglass, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { CompareEntry } from "@/lib/combat/jobs";
import { formatPercent } from "@/lib/combat/presentation";
import type { MemberPreview, PlanSets } from "@/lib/combat/teamPreview";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "../team/MemberAvatar";
import { useTeamDmgData } from "../team/TeamDmgData";
import { ChoiceHoverCard } from "./ChoiceHoverCard";
import { ChoiceDetailContent } from "./ChoiceRowDetail";
import { RowLightConeIcon, RowSetPlanIcons } from "./ChoiceRowIcons";
import {
  type ChoiceMode,
  entryKey,
  entrySets,
  isCurrentEntry,
  topRowCount,
} from "./choiceModel";

/**
 * What a panel without rows shows; members run one at a time, so only the
 * running one is "computing" and the rest of the run is "queued".
 */
export type RankingPlaceholder =
  | "computing"
  | "queued"
  | "none"
  | "failed"
  | "idle";

export interface ChoicePanelMember {
  readonly slot: number;
  readonly characterId: string;
  readonly name: string;
  readonly preview: MemberPreview;
}

/** A plan's label in two parts: the Cavern plan and the Planar set. */
interface PlanLabel {
  /** The 4-piece set's name, or "{A} 2 + {B} 2". */
  readonly cavern: string;
  /**
   * A 4-piece plan's piece count around the set name, as the locale writes
   * it (e.g. "" and " 4"); kept out of the truncated name.
   */
  readonly four: readonly [before: string, after: string] | null;
  readonly planar: string | null;
  /** "{Cavern} 4 + {Planar}" or "{A} 2 + {B} 2 + {Planar}". */
  readonly full: string;
}

/** Stands in for the set name to split the 4-piece message around it. */
const SET_MARK = "\uE000";

function usePlanLabel() {
  const { t } = useI18n();
  const { lookup } = useTeamDmgData();
  const name = (id: string) => lookup.relicSets.get(id)?.name ?? id;
  return (sets: PlanSets): PlanLabel => {
    const separator = t("teamChoice.plan.separator");
    const four = sets.cavern.length === 1 ? name(sets.cavern[0] ?? "") : null;
    const cavern =
      four === null
        ? sets.cavern
            .map((id) => t("teamChoice.plan.two", { set: name(id) }))
            .join(separator)
        : t("teamChoice.plan.four", { set: four });
    const planar = sets.planar ? name(sets.planar) : null;
    const [before = "", after = ""] = t("teamChoice.plan.four", {
      set: SET_MARK,
    }).split(SET_MARK);
    return {
      cavern: four ?? cavern,
      four: four === null ? null : [before, after],
      planar,
      full: [cavern, planar].filter(Boolean).join(separator),
    };
  };
}

function PanelHeader({ member }: { member: ChoicePanelMember }) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-background/50 px-1.5 py-1.5 lg:gap-1.5 lg:px-2">
      <MemberAvatar characterId={member.characterId} decorative />
      <span className="min-w-0 truncate text-xs font-bold md:text-sm lg:text-xs xl:text-sm">
        {member.name}
      </span>
    </div>
  );
}

interface RowView {
  readonly entry: CompareEntry;
  readonly label: string;
  /** Relics mode: the label split over two lines. */
  readonly plan: PlanLabel | null;
  readonly percent: string;
  readonly top: boolean;
  readonly current: boolean;
}

function RankingRow({
  row,
  rank,
  member,
  desktop,
  dialogOpen,
  onOpen,
  onUse,
}: {
  row: RowView;
  rank: number;
  member: ChoicePanelMember;
  desktop: boolean;
  /** A detail dialog of this panel is open. */
  dialogOpen: boolean;
  onOpen: () => void;
  onUse?: () => void;
}) {
  const { t } = useI18n();
  const { lookup } = useTeamDmgData();
  const { entry } = row;
  const sets = entrySets(entry);
  const content = (
    <>
      <span className="w-4 shrink-0 text-right font-mono text-muted-foreground lg:w-5">
        {rank}
      </span>
      {entry.lightCone ? (
        <RowLightConeIcon item={lookup.lightCones.get(entry.lightCone.id)} />
      ) : sets ? (
        <RowSetPlanIcons sets={sets} lookup={lookup.relicSets} />
      ) : null}
      {row.plan ? (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="sr-only">{row.label}</span>
          {row.plan.four ? (
            <span aria-hidden="true" className="flex min-w-0 font-medium">
              {row.plan.four[0] && (
                <span className="shrink-0 whitespace-pre text-muted-foreground">
                  {row.plan.four[0]}
                </span>
              )}
              <span className="truncate">{row.plan.cavern}</span>
              {row.plan.four[1] && (
                <span className="shrink-0 whitespace-pre text-muted-foreground">
                  {row.plan.four[1]}
                </span>
              )}
            </span>
          ) : (
            <span aria-hidden="true" className="truncate font-medium">
              {row.plan.cavern}
            </span>
          )}
          {row.plan.planar && (
            <span
              aria-hidden="true"
              className="truncate text-[10px] text-muted-foreground md:text-xs lg:text-[10px] xl:text-xs"
            >
              {row.plan.planar}
            </span>
          )}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
      )}
      {entry.lightCone && (
        <span className="shrink-0 text-muted-foreground">
          {t("teamChoice.superimposition", {
            value: entry.lightCone.superimposition,
          })}
        </span>
      )}
      {row.current && (
        <span className="sr-only">{t("combat.tools.current")}</span>
      )}
      <span
        className={cn(
          "w-11 shrink-0 text-right font-mono font-bold tabular-nums md:w-14",
          row.top && "text-primary"
        )}
        data-share={entry.relative}
      >
        {row.percent}
      </span>
    </>
  );
  const rowClass = cn(
    "flex w-full min-w-0 items-center gap-1 rounded-md border px-1 py-1 text-left text-xs md:text-sm lg:gap-1.5 lg:px-2 lg:text-xs xl:text-sm",
    row.top ? "border-primary/40 bg-primary/10" : "border-transparent",
    row.current && "ring-1 ring-inset ring-primary"
  );
  const state = {
    "data-top": row.top || undefined,
    "data-current": row.current || undefined,
  };
  if (!entry.ideal)
    return (
      <li>
        <div className={rowClass} {...state}>
          {content}
        </div>
      </li>
    );
  const button = (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={cn(
        rowClass,
        "outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring"
      )}
      {...state}
    >
      {content}
    </button>
  );
  return (
    <li>
      {desktop ? (
        <ChoiceHoverCard
          disabled={dialogOpen}
          content={
            <ChoiceDetailContent
              entry={entry}
              member={member.preview}
              label={row.label}
              percent={row.percent}
              current={row.current}
              onUse={onUse}
            />
          }
        >
          {button}
        </ChoiceHoverCard>
      ) : (
        button
      )}
    </li>
  );
}

/**
 * One member's ranking: candidates best first with their share of the best
 * damage. Top rows are highlighted and the member's current choice ringed;
 * a row opens its detail (hover card on desktop, dialog on click).
 */
export function ChoiceRankingPanel({
  member,
  mode,
  entries,
  placeholder,
  onUse,
}: {
  member: ChoicePanelMember;
  mode: ChoiceMode;
  entries: readonly CompareEntry[] | null;
  placeholder: RankingPlaceholder;
  onUse?: (entry: CompareEntry) => void;
}) {
  const { locale, t } = useI18n();
  const { lookup } = useTeamDmgData();
  const planLabel = usePlanLabel();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [detail, setDetail] = useState<RowView | null>(null);

  const top = entries ? topRowCount(entries) : 0;
  const rows: RowView[] = (entries ?? []).map((entry, index) => {
    const sets = entrySets(entry);
    const plan = sets ? planLabel(sets) : null;
    return {
      entry,
      label: entry.lightCone
        ? (lookup.lightCones.get(entry.lightCone.id)?.name ??
          entry.lightCone.id)
        : (plan?.full ?? ""),
      plan,
      percent: formatPercent(entry.relative, locale),
      top: index < top,
      current: isCurrentEntry(entry, member.preview),
    };
  });

  return (
    <article
      aria-label={member.name}
      className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background/30"
      data-choice-panel={member.slot}
    >
      <PanelHeader member={member} />
      {rows.length > 0 ? (
        <ol
          className="max-h-72 space-y-px overflow-y-auto p-0.5 md:max-h-96"
          data-choice-ranking={mode}
        >
          {rows.map((row, index) => (
            <RankingRow
              key={entryKey(row.entry)}
              row={row}
              rank={index + 1}
              member={member}
              desktop={desktop}
              dialogOpen={detail !== null}
              onOpen={() => setDetail(row)}
              onUse={onUse ? () => onUse(row.entry) : undefined}
            />
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center justify-center px-2 py-6">
          {placeholder === "computing" ? (
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-label={t("teamChoice.computing")}
              data-choice-placeholder="computing"
            />
          ) : placeholder === "queued" ? (
            <Hourglass
              className="h-5 w-5 text-muted-foreground"
              aria-label={t("teamChoice.queued")}
              data-choice-placeholder="queued"
            />
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {placeholder === "failed"
                ? t("combat.tools.failed")
                : placeholder === "none"
                  ? t(
                      mode === "lightCones"
                        ? "teamChoice.noLightCones"
                        : "teamChoice.noSetPlans"
                    )
                  : t("teamChoice.idle")}
            </p>
          )}
        </div>
      )}
      <ResponsiveDialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        {detail && (
          <ResponsiveDialogContent
            closeLabel={t("common.close")}
            className="md:w-[min(26rem,calc(100vw-2rem))] md:p-5"
          >
            <ResponsiveDialogHeader className="sr-only">
              <ResponsiveDialogTitle>
                {member.name} · {detail.label}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {detail.percent}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ChoiceDetailContent
              entry={detail.entry}
              member={member.preview}
              label={detail.label}
              percent={detail.percent}
              current={detail.current}
              onUse={
                onUse
                  ? () => {
                      onUse(detail.entry);
                      setDetail(null);
                    }
                  : undefined
              }
              className="mx-auto max-w-sm"
              headerClassName="pr-9"
              mainStatsClassName="grid-cols-2 md:grid-cols-4"
            />
          </ResponsiveDialogContent>
        )}
      </ResponsiveDialog>
    </article>
  );
}
