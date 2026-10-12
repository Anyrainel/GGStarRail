import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CompactSelect,
  ControlField,
  ControlsRow,
} from "@/components/teams/team/Controls";
import { MemberProgress } from "@/components/teams/team/MemberProgress";
import {
  OptionButton,
  OptionButtonRow,
} from "@/components/teams/team/OptionButton";
import { RunButton } from "@/components/teams/team/RunButton";
import { ErrorBox } from "@/components/teams/team/StatusBoxes";
import { useTeamDmgData } from "@/components/teams/team/TeamDmgData";
import { TeamSectionCard } from "@/components/teams/team/TeamSectionCard";
import type { CritMode } from "@/domain/combat/model/formulas";
import type { SubstatBudget } from "@/domain/combat/optimize/idealRelics";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { combatTypeColor } from "@/lib/game/colors";
import { useTeamStore } from "@/stores/useTeamStore";
import {
  type ChartSeries,
  InvestmentChart,
  signedPercent,
} from "./InvestmentChart";
import {
  CombinedOrder,
  type CopyLabels,
  InvestmentTables,
} from "./InvestmentResults";
import { InvestmentRoster, limitsKey } from "./InvestmentRoster";
import {
  combinedOrder,
  DEFAULT_LIMITS,
  dashPatterns,
  type InvestmentLimits,
  type MemberPath,
  type PathPoint,
  pathPoints,
} from "./investmentModel";
import { type InvestmentMember, useInvestmentRun } from "./useInvestmentRun";

const CRIT_MODE_KEYS = {
  expected: "teamInvestment.crit.expected",
  crit: "teamInvestment.crit.crit",
  nonCrit: "teamInvestment.crit.nonCrit",
} as const satisfies Record<CritMode, MessageKey>;

const BUDGET_KEYS = {
  realistic: "combat.tools.budget.realistic",
  perfect: "combat.tools.budget.perfect",
} as const satisfies Record<SubstatBudget, MessageKey>;

type ResultView = "table" | "order" | "next";

const NO_PATHS: readonly MemberPath[] = [];

/**
 * Investment: which Eidolons and Superimpositions add the most team damage per
 * copy. One job per member, each starting from the member's current state.
 */
export function InvestmentDetail({ team }: { team: TeamPlan }) {
  const { locale, t } = useI18n();
  const { sources, previewOf, references, lookup } = useTeamDmgData();
  const preview = previewOf(team);
  const stored = useTeamStore(
    (state) => state.analysisByTeamId[team.id]?.investment
  );
  const save = useTeamStore((state) => state.setInvestmentSettings);
  const limits: Record<string, InvestmentLimits> = stored?.limits ?? {};
  const budget = stored?.budget ?? "realistic";
  const critMode = stored?.critMode ?? "expected";
  const setLimits = (next: Record<string, InvestmentLimits>) =>
    save(team.id, { limits: next, budget, critMode });
  const setBudget = (next: SubstatBudget) =>
    save(team.id, { limits, budget: next, critMode });
  const setCritMode = (next: CritMode) =>
    save(team.id, { limits, budget, critMode: next });
  const [nextCopies, setNextCopies] = useState(3);
  const [view, setView] = useState<ResultView>("table");

  const members = useMemo<InvestmentMember[]>(
    () =>
      team.members.flatMap((plan, slot) => {
        const member = preview.get(slot);
        if (!plan || !member) return [];
        return [
          {
            slot,
            characterId: plan.characterId,
            combatTypeId:
              references.characters.byId.get(plan.characterId)
                ?.combat_type_id ?? null,
            lightConeId: member.lightCone?.id ?? null,
            from: {
              eidolon: member.eidolon,
              superimposition: member.lightCone?.superimposition ?? null,
            },
            limits: {
              eidolon: Math.max(
                member.eidolon,
                (limits[limitsKey(slot, plan.characterId)] ?? DEFAULT_LIMITS)
                  .eidolon
              ),
              superimposition: Math.max(
                member.lightCone?.superimposition ?? 1,
                (limits[limitsKey(slot, plan.characterId)] ?? DEFAULT_LIMITS)
                  .superimposition
              ),
            },
          },
        ];
      }),
    [team, preview, references, limits]
  );
  const anyIdeal = [...preview.values()].some(
    (member) => member.relicSource === "ideal"
  );
  const options = useMemo(() => ({ budget, critMode }), [budget, critMode]);
  const { result, running, status, run, stop } = useInvestmentRun(
    team,
    sources,
    members,
    options
  );

  const nameOf = (characterId: string) =>
    lookup.characters.get(characterId)?.name ?? characterId;
  const labels: CopyLabels = {
    eidolon: (value) => t("teamInvestment.eidolonShort", { value }),
    superimposition: (value) =>
      t("teamInvestment.superimpositionShort", { value }),
    state: (point: PathPoint) =>
      point.state.superimposition === null
        ? t("teamInvestment.stateValueNoLightCone", {
            eidolon: point.state.eidolon,
          })
        : t("teamInvestment.stateValue", {
            eidolon: point.state.eidolon,
            superimposition: point.state.superimposition,
          }),
  };

  const paths = result?.paths ?? NO_PATHS;
  const points = useMemo(
    () => new Map(paths.map((path) => [path.slot, pathPoints(path)])),
    [paths]
  );
  const order = useMemo(() => combinedOrder(paths), [paths]);
  const dashes = dashPatterns(paths);
  const series: ChartSeries[] = paths.map((path) => ({
    slot: path.slot,
    characterId: path.characterId,
    name: nameOf(path.characterId),
    color:
      (path.combatTypeId ? combatTypeColor(path.combatTypeId) : undefined) ??
      "hsl(var(--primary))",
    dash: dashes.get(path.slot),
    points: points.get(path.slot) ?? [],
  }));
  const failedNames = (result?.failed ?? []).flatMap((slot) => {
    const member = members.find((entry) => entry.slot === slot);
    return member ? [nameOf(member.characterId)] : [];
  });
  const finished = [...status.values()].filter(
    (value) => value === "done" || value === "failed"
  ).length;

  return (
    <TeamSectionCard
      icon={BarChart3}
      title={t("teamAnalysis.investment")}
      bodyClassName="space-y-2"
      data-section="investment-chart"
    >
      <InvestmentRoster
        team={team}
        limits={limits}
        onLimitsChange={(key, next) => setLimits({ ...limits, [key]: next })}
      />
      <ControlsRow>
        {anyIdeal && (
          <ControlField label={t("combat.tools.budget")}>
            {(id) => (
              <CompactSelect
                id={id}
                value={budget}
                options={(Object.keys(BUDGET_KEYS) as SubstatBudget[]).map(
                  (value) => ({ value, label: t(BUDGET_KEYS[value]) })
                )}
                onValueChange={(value) => setBudget(value as SubstatBudget)}
              />
            )}
          </ControlField>
        )}
        <ControlField label={t("teamInvestment.crit")}>
          {(id) => (
            <CompactSelect
              id={id}
              value={critMode}
              options={(Object.keys(CRIT_MODE_KEYS) as CritMode[]).map(
                (value) => ({ value, label: t(CRIT_MODE_KEYS[value]) })
              )}
              onValueChange={(value) => setCritMode(value as CritMode)}
            />
          )}
        </ControlField>
      </ControlsRow>
      <div className="flex justify-center px-2 py-2">
        <RunButton
          label={t("teamInvestment.run")}
          running={running}
          onRun={run}
          onStop={stop}
          disabled={members.length === 0}
        />
      </div>

      {running && (
        <MemberProgress
          phase={t("teamInvestment.analyzing")}
          value={members.length ? finished / members.length : 0}
          entries={members.map((member) => {
            const path = paths.find((entry) => entry.slot === member.slot);
            const last = path ? points.get(path.slot)?.at(-1) : undefined;
            return {
              key: String(member.slot),
              label: nameOf(member.characterId),
              status: status.get(member.slot) ?? "pending",
              value: last
                ? signedPercent(last.percent / 100 - 1, locale)
                : undefined,
            };
          })}
        />
      )}

      {failedNames.length > 0 && (
        <ErrorBox>
          {t("teamInvestment.failed", { names: failedNames.join(", ") })}
        </ErrorBox>
      )}

      {paths.length > 0 ? (
        <>
          <InvestmentChart series={series} stateLabel={labels.state} />
          <OptionButtonRow
            label={t("teamInvestment.view")}
            className="px-0 pt-2 md:px-0 xl:px-0"
          >
            <OptionButton
              selected={view === "table"}
              onSelect={() => setView("table")}
              title={t("teamInvestment.view.table")}
            />
            <OptionButton
              selected={view === "order"}
              onSelect={() => setView("order")}
              title={t("teamInvestment.view.order")}
            />
            <OptionButton
              selected={view === "next"}
              onSelect={() => setView("next")}
              title={t("teamAnalysis.nextCopies")}
            />
          </OptionButtonRow>
          {view === "table" ? (
            <InvestmentTables paths={paths} points={points} labels={labels} />
          ) : (
            <CombinedOrder
              rows={view === "next" ? order.slice(0, nextCopies) : order}
              slots={paths.map((path) => path.slot)}
              labels={labels}
            />
          )}
          {view === "next" && (
            <ControlField label={t("teamAnalysis.nextCopies")}>
              {(id) => (
                <CompactSelect
                  id={id}
                  value={String(nextCopies)}
                  options={Array.from(
                    { length: Math.max(3, order.length) },
                    (_, i) => ({ value: String(i + 1), label: String(i + 1) })
                  )}
                  onValueChange={(value) => setNextCopies(Number(value))}
                />
              )}
            </ControlField>
          )}
        </>
      ) : null}
    </TeamSectionCard>
  );
}
