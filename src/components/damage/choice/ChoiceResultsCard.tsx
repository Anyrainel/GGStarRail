import { Medal } from "lucide-react";
import { useMemo, useState } from "react";
import type { SubstatBudget } from "@/domain/combat/optimize/idealRelics";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { CompareEntry } from "@/lib/combat/jobs";
import type { TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import {
  ConstraintTiles,
  type MemberConstraintInput,
  statConstraints,
} from "../optimizer/ConstraintTiles";
import { CompactSelect, ControlField, ControlsRow } from "../team/Controls";
import { MemberProgress } from "../team/MemberProgress";
import { OptionButton, OptionButtonRow } from "../team/OptionButton";
import { RunButton } from "../team/RunButton";
import { ErrorBox } from "../team/StatusBoxes";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";
import { useTeamDmgData } from "../team/TeamDmgData";
import { TeamSectionCard } from "../team/TeamSectionCard";
import {
  type ChoicePanelMember,
  ChoiceRankingPanel,
  type RankingPlaceholder,
} from "./ChoiceRankingPanel";
import { type ChoiceMode, candidateCount, entrySets } from "./choiceModel";
import { type ChoiceMember, useChoiceRun } from "./useChoiceRun";

const MODE_KEYS = {
  lightCones: "teamChoice.mode.lightCone",
  setPlans: "teamChoice.mode.relics",
} as const satisfies Record<ChoiceMode, MessageKey>;

const BUDGET_KEYS = {
  realistic: "combat.tools.budget.realistic",
  perfect: "combat.tools.budget.perfect",
} as const satisfies Record<SubstatBudget, MessageKey>;

/**
 * Choice Results: per-member rankings of Light Cones (the member's Path) or
 * Relic set plans, each scored with its own ideal Relics.
 */
export function ChoiceResultsCard({ team }: { team: TeamPlan }) {
  const { t } = useI18n();
  const { sources, previewOf, lookup } = useTeamDmgData();
  const updateMember = useTeamStore((state) => state.updateMember);
  const preview = previewOf(team);
  const [mode, setMode] = useState<ChoiceMode>("lightCones");
  const [budget, setBudget] = useState<SubstatBudget>("realistic");
  const [constraints, setConstraints] = useState<
    Record<string, MemberConstraintInput>
  >({});

  const panels = useMemo<ChoicePanelMember[]>(
    () =>
      team.members.flatMap((plan, slot) => {
        const member = preview.get(slot);
        if (!plan || !member) return [];
        return [
          {
            slot,
            characterId: plan.characterId,
            name:
              lookup.characters.get(plan.characterId)?.name ?? plan.characterId,
            preview: member,
          },
        ];
      }),
    [team, preview, lookup]
  );
  const members = useMemo<ChoiceMember[]>(
    () =>
      panels.map((panel) => ({
        slot: panel.slot,
        characterId: panel.characterId,
        constraints: statConstraints(constraints[panel.characterId]),
      })),
    [panels, constraints]
  );

  const choice = useChoiceRun(team, sources, members, budget);
  const result = choice.resultFor(mode);
  const progress = choice.progress;
  const nameOf = (slot: number) =>
    panels.find((panel) => panel.slot === slot)?.name ?? String(slot);

  function placeholderFor(slot: number): RankingPlaceholder {
    const status = choice.statusFor(mode, slot);
    if (status === "running") return "computing";
    if (status === "pending") return "queued";
    if (result?.failed.includes(slot)) return "failed";
    if (result && slot in result.rankings) return "none";
    return "idle";
  }

  function use(slot: number, entry: CompareEntry) {
    const member = preview.get(slot);
    if (!result || !member) return;
    if (entry.lightCone) {
      updateMember(team.id, slot, { lightCone: { ...entry.lightCone } });
    } else {
      const sets = entrySets(entry);
      if (!sets) return;
      updateMember(team.id, slot, {
        setPlan: { cavern: [...sets.cavern], planar: sets.planar },
        ...(member.relicSource === "equipped"
          ? { relics: "ideal" as const }
          : {}),
      });
    }
    const next = useTeamStore
      .getState()
      .teams.find((entry) => entry.id === team.id);
    if (next) choice.carryOver(mode, slot, result, next);
  }

  const failedNames = (result?.failed ?? []).map(nameOf);
  const finished = progress
    ? [...progress.status.values()].filter(
        (status) => status === "done" || status === "failed"
      ).length
    : 0;
  const counts = {
    lightCones: candidateCount(choice.resultFor("lightCones")),
    setPlans: candidateCount(choice.resultFor("setPlans")),
  };

  return (
    <TeamSectionCard
      icon={Medal}
      title={t("teamChoice.title")}
      bodyClassName="p-0 2xl:p-0"
      data-section="choice-results"
    >
      <OptionButtonRow label={t("teamChoice.title")}>
        {(Object.keys(MODE_KEYS) as ChoiceMode[]).map((value) => (
          <OptionButton
            key={value}
            selected={mode === value}
            onSelect={() => setMode(value)}
            disabled={choice.running}
            title={t(MODE_KEYS[value])}
            subtitle={
              counts[value]
                ? t("teamChoice.candidates", { count: counts[value] })
                : undefined
            }
          />
        ))}
      </OptionButtonRow>
      <div className="space-y-2 p-1 2xl:p-2">
        {panels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("teamChoice.noMembers")}
          </p>
        ) : (
          <>
            <ConstraintTiles
              members={panels}
              values={constraints}
              onChange={(characterId, next) =>
                setConstraints((current) => ({
                  ...current,
                  [characterId]: next,
                }))
              }
              disabled={choice.running}
            />
            <ControlsRow className="mb-1">
              <ControlField label={t("combat.tools.budget")}>
                {(id) => (
                  <CompactSelect
                    id={id}
                    value={budget}
                    disabled={choice.running}
                    options={(Object.keys(BUDGET_KEYS) as SubstatBudget[]).map(
                      (value) => ({ value, label: t(BUDGET_KEYS[value]) })
                    )}
                    onValueChange={(value) => setBudget(value as SubstatBudget)}
                  />
                )}
              </ControlField>
              <RunButton
                label={t("teamChoice.run")}
                running={choice.running}
                onRun={() => choice.run(mode)}
                onStop={choice.stop}
              />
            </ControlsRow>

            {progress && (
              <MemberProgress
                variant="ring"
                phase={
                  progress.active === null
                    ? t(MODE_KEYS[progress.mode])
                    : t("teamChoice.phase", { name: nameOf(progress.active) })
                }
                value={
                  progress.status.size ? finished / progress.status.size : 0
                }
                entries={[...progress.status].map(([slot, status]) => ({
                  key: String(slot),
                  label: t("teamChoice.chip", {
                    name: nameOf(slot),
                    mode: t(MODE_KEYS[progress.mode]),
                  }),
                  status,
                }))}
              />
            )}

            {failedNames.length > 0 && (
              <ErrorBox>
                {t("teamChoice.failed", { names: failedNames.join(", ") })}
              </ErrorBox>
            )}

            <TeamCharacterGrid gridClassName="gap-2">
              {panels.map((panel) => (
                <ChoiceRankingPanel
                  key={panel.slot}
                  member={panel}
                  mode={mode}
                  entries={result?.rankings[panel.slot] ?? null}
                  placeholder={placeholderFor(panel.slot)}
                  onUse={
                    choice.running
                      ? undefined
                      : (entry) => use(panel.slot, entry)
                  }
                />
              ))}
            </TeamCharacterGrid>
          </>
        )}
      </div>
    </TeamSectionCard>
  );
}
