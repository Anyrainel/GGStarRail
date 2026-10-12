import { CompactSelect, ControlField } from "@/components/teams/team/Controls";
import { TeamCharacterGrid } from "@/components/teams/team/TeamCharacterGrid";
import { useTeamDmgData } from "@/components/teams/team/TeamDmgData";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { DEFAULT_LIMITS, type InvestmentLimits } from "./investmentModel";

export function limitsKey(slot: number, characterId: string): string {
  return `${slot}:${characterId}`;
}

/** Only additional ceilings; roster identity and starting E/S remain shared. */
export function InvestmentRoster({
  team,
  limits,
  onLimitsChange,
}: {
  team: TeamPlan;
  limits: Readonly<Record<string, InvestmentLimits>>;
  onLimitsChange: (key: string, value: InvestmentLimits) => void;
}) {
  const { t } = useI18n();
  const { previewOf, lookup } = useTeamDmgData();
  const preview = previewOf(team);
  return (
    <TeamCharacterGrid>
      {team.members.map((plan, slot) => {
        const member = preview.get(slot);
        if (!plan || !member) return null;
        const key = limitsKey(slot, plan.characterId);
        const value = limits[key] ?? DEFAULT_LIMITS;
        return (
          <section
            key={key}
            className="min-w-0 space-y-2 rounded-md border border-border bg-background/20 p-2"
          >
            <h4 className="text-sm font-semibold">
              {lookup.characters.get(plan.characterId)?.name ??
                plan.characterId}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <ControlField label={t("teamInvestment.toEidolon")}>
                {(id) => (
                  <CompactSelect
                    id={id}
                    value={String(Math.max(member.eidolon, value.eidolon))}
                    options={Array.from({ length: 7 }, (_, c) => ({
                      value: String(c),
                      label: t("teamInvestment.eidolonShort", { value: c }),
                      disabled: c < member.eidolon,
                    }))}
                    onValueChange={(raw) =>
                      onLimitsChange(key, { ...value, eidolon: Number(raw) })
                    }
                  />
                )}
              </ControlField>
              {member.lightCone && (
                <ControlField label={t("teamInvestment.toSuperimposition")}>
                  {(id) => (
                    <CompactSelect
                      id={id}
                      value={String(
                        Math.max(
                          member.lightCone!.superimposition,
                          value.superimposition
                        )
                      )}
                      options={Array.from({ length: 5 }, (_, i) => i + 1).map(
                        (s) => ({
                          value: String(s),
                          label: t("teamInvestment.superimpositionShort", {
                            value: s,
                          }),
                          disabled: s < member.lightCone!.superimposition,
                        })
                      )}
                      onValueChange={(raw) =>
                        onLimitsChange(key, {
                          ...value,
                          superimposition: Number(raw),
                        })
                      }
                    />
                  )}
                </ControlField>
              )}
            </div>
          </section>
        );
      })}
    </TeamCharacterGrid>
  );
}
