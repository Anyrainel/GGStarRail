import { Swords } from "lucide-react";
import { SCENARIO_PRESETS } from "@/domain/combat/team/input";
import { useI18n } from "@/i18n/I18nContext";
import {
  SCENARIO_LABEL_KEYS,
  type ScenarioPresetId,
} from "@/lib/combat/presentation";
import type { TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import { CompactNumberInput, ControlField, ControlsRow } from "./Controls";
import { OptionButton, OptionButtonRow } from "./OptionButton";
import { TeamSectionCard } from "./TeamSectionCard";

const SCENARIO_ORDER = Object.keys(SCENARIO_LABEL_KEYS) as ScenarioPresetId[];

/**
 * The battle every tab simulates: the enemy preset, cycles and enemy level.
 * These are the only scenario controls on a Team DMG page.
 */
export function BattleSetupCard({
  team,
  collapsible = false,
}: {
  team: TeamPlan;
  /** Investment shows it collapsible (open by default). */
  collapsible?: boolean;
}) {
  const { t } = useI18n();
  const updateTeam = useTeamStore((state) => state.updateTeam);

  return (
    <TeamSectionCard
      icon={Swords}
      title={t("teamDmg.battle.title")}
      collapsible={collapsible}
      bodyClassName="p-0 2xl:p-0"
      data-section="battle-setup"
    >
      <OptionButtonRow label={t("combat.scenario")}>
        {SCENARIO_ORDER.map((id) => {
          const preset = SCENARIO_PRESETS[id];
          return (
            <OptionButton
              key={id}
              selected={team.scenario === id}
              onSelect={() => updateTeam(team.id, { scenario: id })}
              title={t(SCENARIO_LABEL_KEYS[id])}
              subtitle={
                preset.enemyCount === 1
                  ? t("teamDmg.scenarioFactsOne", {
                      toughness: preset.toughness,
                    })
                  : t("teamDmg.scenarioFacts", {
                      count: preset.enemyCount,
                      toughness: preset.toughness,
                    })
              }
            />
          );
        })}
      </OptionButtonRow>
      <ControlsRow className="mb-0 px-2 pb-2.5">
        <ControlField label={t("combat.cycles")}>
          {(id) => (
            <CompactNumberInput
              id={id}
              value={team.cycles}
              min={1}
              max={30}
              onCommit={(cycles) => {
                if (cycles !== null) updateTeam(team.id, { cycles });
              }}
            />
          )}
        </ControlField>
        <ControlField label={t("combat.enemyLevel")}>
          {(id) => (
            <CompactNumberInput
              id={id}
              value={team.enemyLevel}
              min={1}
              max={120}
              onCommit={(enemyLevel) => {
                if (enemyLevel !== null) updateTeam(team.id, { enemyLevel });
              }}
            />
          )}
        </ControlField>
      </ControlsRow>
    </TeamSectionCard>
  );
}
