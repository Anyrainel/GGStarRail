import { Eye, Swords, TriangleAlert } from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import {
  RelicSlotGrid,
  RelicSlotPlaceholder,
} from "@/components/shared/relic/RelicSlotGrid";
import {
  CavernPlanIcon,
  PlanarSetIcon,
  type SetRef,
} from "@/components/shared/relic/SetPlanIcon";
import { APP_PATHS } from "@/config/navigation";
import type { Relic } from "@/domain/account/schemas";
import type { CritMode } from "@/domain/combat/model/formulas";
import type { SubstatBudget } from "@/domain/combat/optimize/idealRelics";
import type { SetPlan } from "@/domain/combat/optimize/relics";
import { FIXED_MAIN_STAT } from "@/domain/stats";
import type { TeamSimulationState } from "@/hooks/useTeamSimulation";
import { useI18n } from "@/i18n/I18nContext";
import { runCombatJob } from "@/lib/combat/client";
import type {
  IdealResponse,
  MainStatChoices,
  MemberOutcome,
  OptimizedLoadout,
  OptimizeResponse,
} from "@/lib/combat/jobs";
import { formatCompactDamage } from "@/lib/combat/presentation";
import { resultCacheKey } from "@/lib/combat/resultCache";
import { planSets } from "@/lib/combat/teamPreview";
import {
  type EquippedSetBonus,
  equippedSetSummary,
  type RelicKind,
  type RelicSlotId,
} from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";
import type { TeamPlan } from "@/stores/teamSchemas";
import { CompactSelect, ControlField, ControlsRow } from "../team/Controls";
import {
  MemberProgress,
  type MemberProgressEntry,
} from "../team/MemberProgress";
import { OptionButton, OptionButtonRow } from "../team/OptionButton";
import { RunButton } from "../team/RunButton";
import { ErrorBox, InlineEmptyBox } from "../team/StatusBoxes";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";
import { useTeamDmgData } from "../team/TeamDmgData";
import { TeamSectionCard } from "../team/TeamSectionCard";
import type { MemberItemLookup } from "../team/types";
import {
  ConstraintTiles,
  type MemberConstraintInput,
  statConstraints,
} from "./ConstraintTiles";
import { DamagePill } from "./DamagePill";
import {
  MainStatChip,
  RelicPieceIcon,
  useSlotName,
  useStatName,
} from "./RelicCells";
import {
  ANY_MAIN_STAT,
  DeltaChip,
  type MainStatChoice,
  MainStatFilter,
  StatSheetTile,
  type StatSheetView,
} from "./StatSheetTile";
import { PanelView, RollsView, ValueView } from "./StatViews";
import { SwapGuidePanel } from "./SwapGuidePanel";
import { buildSwapGuide } from "./swapGuide";
import { type AnalysisRunState, useAnalysisRun } from "./useAnalysisRun";

export type RelicsMode = "current" | "optimize" | "ideal";

/** Pieces the Relic optimizer may use (mirrors the optimize job). */
function isEligibleRelic(relic: Relic): boolean {
  return relic.rarity === 5 && relic.level >= 12;
}

function setRef(lookup: MemberItemLookup, setId: string): SetRef {
  const item = lookup.relicSets.get(setId);
  return {
    id: setId,
    name: item?.name ?? setId,
    rarity: item?.rarity ?? null,
    iconPath: item?.iconPath ?? null,
  };
}

/**
 * The loadout Optimize applies to a member: the best one found, unless the
 * member wears its own Relics and nothing found beats them.
 */
function appliedLoadout(
  result: OptimizeResponse | null | undefined,
  equipped: boolean
): OptimizedLoadout | null {
  const best = result?.loadouts[0];
  if (!result || !best) return null;
  return equipped && best.damage <= result.currentDamage ? null : best;
}

/** Applied loadouts as account Relic overrides, by team slot. */
function relicOverrides(
  results: ReadonlyMap<number, OptimizeResponse>,
  equipped: ReadonlySet<number>
): Record<number, Record<string, string>> {
  const overrides: Record<number, Record<string, string>> = {};
  for (const [slot, result] of results) {
    const loadout = appliedLoadout(result, equipped.has(slot));
    if (!loadout) continue;
    overrides[slot] = Object.fromEntries(
      Object.entries(loadout.relicKeys).filter(([, key]) => key)
    );
  }
  return overrides;
}

function relicsBySlot(
  relics: readonly Relic[]
): Partial<Record<RelicSlotId, Relic>> {
  const bySlot: Partial<Record<RelicSlotId, Relic>> = {};
  for (const relic of relics) bySlot[relic.slot] = relic;
  return bySlot;
}

/**
 * One line per group: the set art and the bonus the pieces activate. The
 * Cavern line also names the sets; the narrow Planar line keeps the name in
 * its tooltip.
 */
function SetBonusHeaderCell({
  kind,
  bonuses,
}: {
  kind: RelicKind;
  /** Active bonuses: a 4-piece, one or two 2-pieces, or none. */
  bonuses: readonly EquippedSetBonus[];
}) {
  const { t } = useI18n();
  const { lookup } = useTeamDmgData();
  if (!bonuses.length) {
    const none = t("teamOptimizer.noSetBonus");
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground md:text-xs",
          kind === "planar" && "justify-center"
        )}
        title={none}
        data-set-plan-empty={kind}
      >
        <RelicKindIcon kind={kind} className="h-4 w-4" decorative />
        {kind === "cavern" ? (
          <span className="min-w-0 truncate">{none}</span>
        ) : (
          <>
            <span className="font-mono font-bold" aria-hidden>
              —
            </span>
            <span className="sr-only">{none}</span>
          </>
        )}
      </span>
    );
  }
  const names = bonuses
    .map((bonus) => lookup.relicSets.get(bonus.setId)?.name ?? bonus.setId)
    .join(" + ");
  const badge =
    bonuses.length > 1 ? t("relic.plan.twoPlusTwo") : String(bonuses[0]?.tier);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground md:text-xs",
        kind === "planar" && "justify-center"
      )}
      title={names}
      data-set-bonus-header={kind}
    >
      {bonuses.map((bonus) => (
        <AssetImage
          key={bonus.setId}
          kind="relic-set"
          id={bonus.setId}
          sourcePath={lookup.relicSets.get(bonus.setId)?.iconPath}
          alt=""
          aria-hidden="true"
          className="h-4 w-4 shrink-0 object-contain"
        />
      ))}
      {kind === "cavern" ? (
        <span className="min-w-0 truncate">{names}</span>
      ) : (
        <span className="sr-only">{names}</span>
      )}
      <span className="shrink-0 font-mono font-bold text-foreground">
        {badge}
      </span>
    </span>
  );
}

/** Six account Relics under the set bonuses they activate together. */
function PieceGrid({ relics }: { relics: readonly Relic[] }) {
  const slotName = useSlotName();
  const bySlot = relicsBySlot(relics);
  const bonuses = equippedSetSummary(relics);
  return (
    <RelicSlotGrid
      header={{
        cavern: <SetBonusHeaderCell kind="cavern" bonuses={bonuses.cavern} />,
        planar: (
          <SetBonusHeaderCell
            kind="planar"
            bonuses={bonuses.planar ? [bonuses.planar] : []}
          />
        ),
      }}
      renderSlot={(slot, size) => {
        const relic = bySlot[slot];
        return relic ? (
          <RelicPieceIcon relic={relic} size={size} />
        ) : (
          <RelicSlotPlaceholder label={slotName(slot)} size={size} />
        );
      }}
    />
  );
}

/** Ideal main stats per slot, with the set plan in the spare Planar cells. */
function MainStatGrid({
  mainStats,
  plan,
}: {
  mainStats: Readonly<Record<string, string>>;
  plan: SetPlan;
}) {
  const { lookup } = useTeamDmgData();
  const sets = planSets(plan);
  const icons = (size: ItemIconSize) => (
    <div className="flex items-center justify-center gap-0.5">
      <CavernPlanIcon
        sets={sets.cavern.map((id) => setRef(lookup, id))}
        size={size}
      />
      <PlanarSetIcon
        set={sets.planar ? setRef(lookup, sets.planar) : null}
        size={size}
      />
    </div>
  );
  return (
    <RelicSlotGrid
      layout="stacked"
      maxIconSize="xs"
      header={{ planar: icons("xs") }}
      renderSlot={(slot, size) => {
        const fixed = slot === "head" || slot === "hands";
        return (
          <MainStatChip
            slot={slot}
            propertyId={
              mainStats[slot] ??
              (fixed ? FIXED_MAIN_STAT[slot as "head" | "hands"] : undefined)
            }
            fixed={fixed}
            size={size}
          />
        );
      }}
    />
  );
}

function SpeedLabel({ value }: { value: number }) {
  const { locale, t } = useI18n();
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground md:text-xs">
      {t("teamOptimizer.speedValue", {
        value: new Intl.NumberFormat(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value),
      })}
    </span>
  );
}

/** Variable main-stat slots, in game order: Body, Feet, Sphere, Rope. */
const LOADOUT_MAIN_SLOTS = [
  "body",
  "feet",
  "planarSphere",
  "linkRope",
] as const satisfies readonly RelicSlotId[];

/**
 * Every loadout the search ranked, each against the member's current Relics:
 * its set bonuses, variable main stats, SPD and change. The applied one is
 * marked.
 */
function LoadoutsView({
  result,
  applied,
  relicByKey,
}: {
  result: OptimizeResponse;
  applied: OptimizedLoadout | null;
  relicByKey: ReadonlyMap<string, Relic>;
}) {
  const { t } = useI18n();
  const stat = useStatName();
  return (
    <ol
      aria-label={t("teamOptimizer.view.loadouts")}
      className="flex flex-col divide-y divide-border text-[10px] md:text-xs"
    >
      {result.loadouts.map((loadout, index) => {
        const relics = Object.values(loadout.relicKeys).flatMap((key) => {
          const relic = relicByKey.get(key);
          return relic ? [relic] : [];
        });
        const bonuses = equippedSetSummary(relics);
        const mains = LOADOUT_MAIN_SLOTS.map((slot) =>
          relicByKey.get(loadout.relicKeys[slot] ?? "")
        );
        const current = loadout === applied;
        return (
          <li
            key={Object.values(loadout.relicKeys).join("|")}
            className="flex min-w-0 flex-col gap-0.5 py-1"
            aria-current={current || undefined}
            data-loadout={index + 1}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "w-3 shrink-0 text-right font-mono font-bold tabular-nums",
                  current ? "text-primary" : "text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <SetBonusHeaderCell kind="cavern" bonuses={bonuses.cavern} />
              </span>
              <SetBonusHeaderCell
                kind="planar"
                bonuses={bonuses.planar ? [bonuses.planar] : []}
              />
              <DeltaChip
                value={loadout.damage}
                reference={result.currentDamage}
              />
            </div>
            <div className="flex min-w-0 items-start gap-1.5 pl-[1.125rem]">
              {/* Wraps between stats rather than hiding the ones that tell
                  the ranks apart. */}
              <span
                className="min-w-0 flex-1 font-semibold"
                title={mains
                  .map((relic) =>
                    relic ? stat.full(relic.mainStat.statId) : "—"
                  )
                  .join(" / ")}
                data-loadout-mains
              >
                {mains.map((relic, slotIndex) => (
                  <Fragment key={LOADOUT_MAIN_SLOTS[slotIndex]}>
                    {slotIndex > 0 && (
                      <>
                        <span className="mx-0.5 text-muted-foreground">/</span>
                        <wbr />
                      </>
                    )}
                    <span className="whitespace-nowrap">
                      {relic ? stat.short(relic.mainStat.statId) : "—"}
                    </span>
                  </Fragment>
                ))}
              </span>
              <SpeedLabel value={loadout.speed} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

interface TeamMember {
  readonly slot: number;
  readonly characterId: string;
  readonly name: string;
}

function progressEntries<T>(
  state: AnalysisRunState<T>,
  members: readonly TeamMember[],
  value: (result: T, slot: number) => ReactNode
): MemberProgressEntry[] {
  return members.map((member) => {
    const entry = state.entries.get(member.slot);
    return {
      key: String(member.slot),
      label: member.name,
      status: entry?.status ?? "pending",
      value: entry?.result ? value(entry.result, member.slot) : undefined,
    };
  });
}

function RunProgress<T>({
  state,
  members,
  phaseKey,
  combined,
  value,
}: {
  state: AnalysisRunState<T>;
  members: readonly TeamMember[];
  phaseKey: "teamOptimizer.phase.optimize" | "teamOptimizer.phase.ideal";
  combined: boolean;
  value: (result: T, slot: number) => ReactNode;
}) {
  const { t } = useI18n();
  const done = [...state.entries.values()].filter(
    (entry) => entry.status === "done" || entry.status === "failed"
  ).length;
  const steps = members.length + (combined ? 1 : 0);
  const activeName =
    typeof state.active === "number"
      ? (members.find((member) => member.slot === state.active)?.name ?? "")
      : null;
  return (
    <MemberProgress
      phase={
        state.active === "team"
          ? t("combat.damage.running")
          : t(phaseKey, { name: activeName ?? "" })
      }
      value={steps > 0 ? done / steps : 0}
      entries={progressEntries(state, members, value)}
    />
  );
}

/**
 * Team Relics and the damage they deal: the current team, Relics optimized
 * from the account inventory, or theoretical ideal Relics.
 */
export function RelicsDamageCard({
  team,
  simulation,
  critMode,
  onCritModeChange,
}: {
  team: TeamPlan;
  simulation: TeamSimulationState;
  critMode: CritMode;
  onCritModeChange: (mode: CritMode) => void;
}) {
  const { locale, t } = useI18n();
  const { account, sources, lookup, previewOf } = useTeamDmgData();
  const [mode, setMode] = useState<RelicsMode>("current");
  // Floors and main-stat filters belong to a Character (a team holds each
  // Character once), so they follow it when the roster shifts slots.
  const [constraints, setConstraints] = useState<
    Record<string, MemberConstraintInput>
  >({});
  const [mainStats, setMainStats] = useState<Record<string, MainStatChoice>>(
    {}
  );
  const [budget, setBudget] = useState<SubstatBudget>("realistic");

  const members = useMemo<TeamMember[]>(
    () =>
      team.members.flatMap((member, slot) =>
        member
          ? [
              {
                slot,
                characterId: member.characterId,
                name:
                  lookup.characters.get(member.characterId)?.name ??
                  member.characterId,
              },
            ]
          : []
      ),
    [team.members, lookup]
  );
  const slots = useMemo(() => members.map((member) => member.slot), [members]);
  const preview = previewOf(team);
  /** Members wearing their own Relics: Optimize keeps them unless beaten. */
  const equippedSlots = useMemo(
    () =>
      new Set(
        [...preview.values()]
          .filter((member) => member.relicSource === "equipped")
          .map((member) => member.slot)
      ),
    [preview]
  );
  const eligible = useMemo(
    () => (account?.relics ?? []).filter(isEligibleRelic).length,
    [account]
  );
  const relicByKey = useMemo(
    () => new Map((account?.relics ?? []).map((relic) => [relic.key, relic])),
    [account]
  );

  // Constraints are part of the inputs: a change shows that input's results.
  const constraintBySlot = useMemo(
    () =>
      Object.fromEntries(
        members.flatMap(({ slot, characterId }) => {
          const value = statConstraints(constraints[characterId]);
          return value ? [[slot, value]] : [];
        })
      ),
    [members, constraints]
  );
  const mainStatBySlot = useMemo(
    () =>
      Object.fromEntries(
        members.flatMap(({ slot, characterId }) => {
          const choice = mainStats[characterId];
          const entries = Object.entries(choice ?? {}).filter(
            ([, value]) => value
          );
          // "Any" sends an empty list: every main stat in that slot.
          return entries.length
            ? [
                [
                  slot,
                  Object.fromEntries(
                    entries.map(([key, value]) => [
                      key,
                      value === ANY_MAIN_STAT ? [] : [value],
                    ])
                  ) as MainStatChoices,
                ],
              ]
            : [];
        })
      ),
    [members, mainStats]
  );

  // Members are optimized in turn: each search sees the loadouts applied to
  // the members before it and cannot take their Relics.
  const runOptimize = useCallback(
    (slot: number, previous: ReadonlyMap<number, OptimizeResponse>) =>
      runCombatJob(
        {
          kind: "optimize",
          request: {
            team,
            sources,
            slot,
            critMode,
            constraints: constraintBySlot[slot],
            relicOverrides: relicOverrides(previous, equippedSlots),
          },
        },
        "analysis"
      ),
    [team, sources, critMode, constraintBySlot, equippedSlots]
  );
  const combineOptimize = useCallback(
    async (results: ReadonlyMap<number, OptimizeResponse>) => {
      const overrides = relicOverrides(results, equippedSlots);
      if (!Object.keys(overrides).length) return null;
      return runCombatJob(
        {
          kind: "simulate",
          request: { team, sources, critMode, relicOverrides: overrides },
        },
        "analysis"
      );
    },
    [team, sources, critMode, equippedSlots]
  );
  const runIdeal = useCallback(
    (slot: number) =>
      runCombatJob(
        {
          kind: "ideal",
          request: {
            team,
            sources,
            slot,
            critMode,
            budget,
            constraints: constraintBySlot[slot],
            mainStats: mainStatBySlot[slot],
          },
        },
        "analysis"
      ),
    [team, sources, critMode, budget, constraintBySlot, mainStatBySlot]
  );

  const optimize = useAnalysisRun<OptimizeResponse>({
    key: resultCacheKey("optimizer", "optimize", team, sources, {
      critMode,
      constraints: constraintBySlot,
    }),
    slots,
    runMember: runOptimize,
    combine: combineOptimize,
  });
  const ideal = useAnalysisRun<IdealResponse>({
    key: resultCacheKey("optimizer", "ideal", team, sources, {
      critMode,
      budget,
      constraints: constraintBySlot,
      mainStats: mainStatBySlot,
    }),
    slots,
    runMember: runIdeal,
  });

  const outcomes = new Map(
    (simulation.result?.members ?? []).map((member) => [member.slot, member])
  );
  const analysisRunning = optimize.running || ideal.running;

  const optimizeBlocked = mode === "optimize" && eligible === 0;
  const modeRun =
    mode === "optimize" && !optimizeBlocked
      ? optimize
      : mode === "ideal"
        ? ideal
        : null;
  const optimizeCombined =
    modeRun === optimize ? (optimize.state?.combined ?? null) : null;
  const pillResult = optimizeCombined ?? simulation.result;
  const pillReference = optimizeCombined ? simulation.result : null;
  const warnings = pillResult?.warnings.length ?? 0;
  const failedMembers =
    modeRun?.state &&
    [...modeRun.state.entries.values()].some(
      (entry) => entry.status === "failed"
    );

  function setConstraint(characterId: string, next: MemberConstraintInput) {
    setConstraints((current) => ({ ...current, [characterId]: next }));
  }

  function currentTile(member: TeamMember, outcome: MemberOutcome) {
    const equipped = outcome.relicSource === "equipped";
    const views: StatSheetView[] = [
      {
        id: "panel",
        label: t("teamOptimizer.view.panel"),
        content: <PanelView panel={outcome.panel} />,
      },
    ];
    if (!equipped && outcome.ideal)
      views.push({
        id: "rolls",
        label: t("teamOptimizer.view.rolls"),
        content: <RollsView rolls={outcome.ideal.rolls} />,
      });
    return (
      <StatSheetTile
        key={member.slot}
        slot={member.slot}
        characterId={member.characterId}
        name={member.name}
        relics={
          equipped ? (
            <PieceGrid
              relics={preview.get(member.slot)?.equippedRelics ?? []}
            />
          ) : (
            <MainStatGrid
              mainStats={outcome.ideal?.mainStats ?? {}}
              plan={outcome.setPlan}
            />
          )
        }
        headerEnd={<SpeedLabel value={outcome.panel.spd} />}
        views={views}
      />
    );
  }

  function optimizeTile(member: TeamMember) {
    const entry = optimize.state?.entries.get(member.slot);
    const result = entry?.result ?? null;
    const applied = appliedLoadout(result, equippedSlots.has(member.slot));
    // Nothing beat the Relics the member wears: it keeps them.
    const kept = result !== null && result.loadouts.length > 0 && !applied;
    const combinedPanel = optimizeCombined?.members.find(
      (outcome) => outcome.slot === member.slot
    )?.panel;
    const relics = kept
      ? (preview.get(member.slot)?.equippedRelics ?? [])
      : applied
        ? Object.values(applied.relicKeys).flatMap((key) => {
            const relic = relicByKey.get(key);
            return relic ? [relic] : [];
          })
        : [];
    return (
      <StatSheetTile
        key={member.slot}
        slot={member.slot}
        characterId={member.characterId}
        name={member.name}
        headerEnd={
          applied && result ? (
            <>
              <SpeedLabel value={applied.speed} />
              <DeltaChip
                value={applied.damage}
                reference={result.currentDamage}
              />
            </>
          ) : kept && combinedPanel ? (
            <SpeedLabel value={combinedPanel.spd} />
          ) : null
        }
        relics={<PieceGrid relics={relics} />}
        notice={
          entry?.status === "failed"
            ? t("combat.tools.failed")
            : kept
              ? t("teamOptimizer.keptCurrent")
              : result && !applied
                ? t("combat.tools.noResults")
                : null
        }
        views={[
          ...(combinedPanel && (applied || kept)
            ? [
                {
                  id: "panel",
                  label: t("teamOptimizer.view.panel"),
                  content: <PanelView panel={combinedPanel} />,
                },
              ]
            : []),
          ...(result?.loadouts.length
            ? [
                {
                  id: "loadouts",
                  label: t("teamOptimizer.view.loadouts"),
                  content: (
                    <LoadoutsView
                      result={result}
                      applied={applied}
                      relicByKey={relicByKey}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    );
  }

  /** Names the floor an infeasible ideal result misses. */
  function infeasibleNotice(slot: number, result: IdealResponse): string {
    const floor = constraintBySlot[slot];
    const speedShort =
      floor?.minSpeed !== undefined && result.speed + 1e-9 < floor.minSpeed;
    const energyShort =
      floor?.minEnergyRegen !== undefined &&
      result.panel.energyRegen + 1e-9 < floor.minEnergyRegen;
    if (energyShort && speedShort) return t("combat.tools.noResults");
    if (energyShort) return t("teamOptimizer.infeasible.energyRegen");
    return t("combat.tools.infeasible");
  }

  function idealTile(member: TeamMember) {
    const entry = ideal.state?.entries.get(member.slot);
    const result = entry?.result ?? null;
    const outcome = outcomes.get(member.slot);
    return (
      <StatSheetTile
        key={member.slot}
        slot={member.slot}
        characterId={member.characterId}
        name={member.name}
        headerExtra={
          <MainStatFilter
            name={member.name}
            value={mainStats[member.characterId] ?? {}}
            defaults={preview.get(member.slot)?.mainStats ?? {}}
            disabled={analysisRunning}
            onChange={(next) =>
              setMainStats((current) => ({
                ...current,
                [member.characterId]: next,
              }))
            }
          />
        }
        headerEnd={
          result ? (
            <>
              <SpeedLabel value={result.speed} />
              <DeltaChip
                value={result.damage}
                reference={result.currentDamage}
              />
            </>
          ) : null
        }
        relics={
          result ? (
            <MainStatGrid mainStats={result.mainStats} plan={result.plan} />
          ) : (
            <MainStatGrid
              mainStats={{}}
              plan={outcome?.setPlan ?? { cavern: null, planar: null }}
            />
          )
        }
        notice={
          entry?.status === "failed"
            ? t("combat.tools.failed")
            : result && !result.feasible
              ? infeasibleNotice(member.slot, result)
              : null
        }
        views={
          result
            ? [
                {
                  id: "panel",
                  label: t("teamOptimizer.view.panel"),
                  content: <PanelView panel={result.panel} />,
                },
                {
                  id: "rolls",
                  label: t("teamOptimizer.view.rolls"),
                  content: <RollsView rolls={result.rolls} />,
                },
                {
                  id: "value",
                  label: t("teamOptimizer.view.value"),
                  content: <ValueView weights={result.weights} />,
                },
              ]
            : []
        }
      />
    );
  }

  let sheets: ReactNode;
  if (members.length === 0) {
    sheets = (
      <InlineEmptyBox icon={Swords}>
        {t("teamOptimizer.noMembers")}
      </InlineEmptyBox>
    );
  } else if (mode === "current" || optimizeBlocked) {
    // Without eligible Relics, Optimize can never run: show the current team.
    const tiles = members.flatMap((member) => {
      const outcome = outcomes.get(member.slot);
      return outcome ? [currentTile(member, outcome)] : [];
    });
    sheets = tiles.length ? (
      <TeamCharacterGrid>{tiles}</TeamCharacterGrid>
    ) : simulation.failed ? null : (
      <InlineEmptyBox icon={Swords}>
        {t("combat.damage.running")}
      </InlineEmptyBox>
    );
  } else if (mode === "optimize") {
    const started = [...(optimize.state?.entries.values() ?? [])].some(
      (entry) => entry.status === "done" || entry.status === "failed"
    );
    sheets = started ? (
      <TeamCharacterGrid>{members.map(optimizeTile)}</TeamCharacterGrid>
    ) : optimize.running ? null : (
      <InlineEmptyBox icon={Swords}>
        {t("teamOptimizer.noResults")}
      </InlineEmptyBox>
    );
  } else {
    // Ideal tiles show the main-stat filters before the first run.
    sheets = <TeamCharacterGrid>{members.map(idealTile)}</TeamCharacterGrid>;
  }

  const swapGuide =
    modeRun === optimize && optimize.state?.finished && !optimize.running
      ? buildSwapGuide(
          members.flatMap((member) => {
            const applied = appliedLoadout(
              optimize.state?.entries.get(member.slot)?.result,
              equippedSlots.has(member.slot)
            );
            return applied
              ? [
                  {
                    teamSlot: member.slot,
                    characterId: member.characterId,
                    relicKeys: applied.relicKeys,
                  },
                ]
              : [];
          }),
          account
        )
      : null;

  return (
    <TeamSectionCard
      icon={Eye}
      title={t("teamOptimizer.title")}
      bodyClassName="p-0 2xl:p-0"
      data-section="relics-damage"
    >
      <OptionButtonRow label={t("teamOptimizer.title")}>
        <OptionButton
          selected={mode === "current"}
          onSelect={() => setMode("current")}
          title={t("teamOptimizer.mode.current")}
        />
        <OptionButton
          selected={mode === "optimize"}
          onSelect={() => setMode("optimize")}
          title={t("teamOptimizer.mode.optimize")}
          subtitle={
            account
              ? t("teamOptimizer.eligibleRelics", { count: eligible })
              : undefined
          }
        />
        <OptionButton
          selected={mode === "ideal"}
          onSelect={() => setMode("ideal")}
          title={t("teamOptimizer.mode.ideal")}
        />
      </OptionButtonRow>
      {optimizeBlocked && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border px-4 py-2 text-xs md:px-6"
          data-optimize-restriction
        >
          <TriangleAlert
            className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--quality-gold))]"
            aria-hidden
          />
          <span>{t("combat.tools.needsRelics")}</span>
          <Link
            to={APP_PATHS.inventory}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t("nav.inventory")}
          </Link>
        </div>
      )}
      <div className="space-y-2 p-1 2xl:p-2">
        {modeRun && (
          <ConstraintTiles
            members={members}
            values={constraints}
            onChange={setConstraint}
            disabled={analysisRunning}
          />
        )}
        {modeRun && (
          <ControlsRow className="mb-1">
            {mode === "ideal" && (
              <ControlField label={t("combat.tools.budget")}>
                {(id) => (
                  <CompactSelect
                    id={id}
                    value={budget}
                    disabled={analysisRunning}
                    onValueChange={(value) => setBudget(value as SubstatBudget)}
                    options={[
                      {
                        value: "realistic",
                        label: t("combat.tools.budget.realistic"),
                      },
                      {
                        value: "perfect",
                        label: t("combat.tools.budget.perfect"),
                      },
                    ]}
                  />
                )}
              </ControlField>
            )}
            <RunButton
              label={
                mode === "optimize"
                  ? t("teamOptimizer.run.optimize")
                  : t("teamOptimizer.run.ideal")
              }
              running={modeRun.running}
              onRun={() => {
                void modeRun.run();
              }}
              onStop={modeRun.stop}
              disabled={
                members.length === 0 ||
                (mode === "optimize" ? ideal.running : optimize.running)
              }
            />
          </ControlsRow>
        )}
        {mode === "current" && simulation.failed && (
          <ErrorBox>{t("combat.damage.failed")}</ErrorBox>
        )}
        {modeRun && failedMembers && !modeRun.running && (
          <ErrorBox>{t("combat.tools.failed")}</ErrorBox>
        )}
        {warnings > 0 && (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("combat.damage.warning")}
          </p>
        )}
        {modeRun === optimize && optimize.progress && (
          <RunProgress
            state={optimize.progress}
            members={members}
            phaseKey="teamOptimizer.phase.optimize"
            combined
            value={(result, slot) =>
              formatCompactDamage(
                appliedLoadout(result, equippedSlots.has(slot))?.damage ??
                  result.currentDamage,
                locale
              )
            }
          />
        )}
        {mode === "ideal" && ideal.progress && (
          <RunProgress
            state={ideal.progress}
            members={members}
            phaseKey="teamOptimizer.phase.ideal"
            combined={false}
            value={(result) => formatCompactDamage(result.damage, locale)}
          />
        )}
        {sheets}
        {members.length > 0 && (
          <DamagePill
            result={pillResult}
            reference={pillReference}
            running={simulation.running}
            cycles={team.cycles}
            critMode={critMode}
            onCritModeChange={onCritModeChange}
          />
        )}
        {swapGuide && swapGuide.columns.length > 0 && (
          <SwapGuidePanel guide={swapGuide} />
        )}
      </div>
    </TeamSectionCard>
  );
}
