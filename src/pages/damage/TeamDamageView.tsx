import { Swords } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { CombatToolsPanel } from "@/components/damage/CombatToolsPanel";
import { DamageSummary } from "@/components/damage/DamageSummary";
import {
  type MemberPickerItems,
  TeamMemberCard,
} from "@/components/damage/TeamMemberCard";
import { TeamToolbar } from "@/components/damage/TeamToolbar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useTeamSimulation } from "@/hooks/useTeamSimulation";
import { useI18n } from "@/i18n/I18nContext";
import { catalogPickerItems } from "@/lib/catalogPickerItems";
import type { WorkspaceSources } from "@/lib/combat/jobs";
import { useTeamStore } from "@/stores/useTeamStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function TeamDamageView() {
  const { locale, t } = useI18n();
  const { data, error, loading } = useBuildReferences();
  const teams = useTeamStore((state) => state.teams);
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const createTeam = useTeamStore((state) => state.createTeam);
  const setActiveTeam = useTeamStore((state) => state.setActiveTeam);
  const setMember = useTeamStore((state) => state.setMember);
  const updateMember = useTeamStore((state) => state.updateMember);
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const characterLightConeIds = useWorkspaceStore(
    (state) => state.characterLightConeIds
  );
  const team =
    teams.find((entry) => entry.id === activeTeamId) ?? teams[0] ?? null;

  useEffect(() => {
    if (team && team.id !== activeTeamId) setActiveTeam(team.id);
  }, [team, activeTeamId, setActiveTeam]);

  const sources = useMemo<WorkspaceSources>(
    () => ({ account, builds, characterLightConeIds }),
    [account, builds, characterLightConeIds]
  );
  const simulation = useTeamSimulation(team, sources);

  const items = useMemo<MemberPickerItems | null>(() => {
    if (!data) return null;
    const trailblazer = t("terms.trailblazer");
    return {
      characters: catalogPickerItems("character", data, locale, trailblazer),
      lightCones: catalogPickerItems("light-cone", data, locale, trailblazer),
      relicSets: catalogPickerItems("relic-set", data, locale, trailblazer),
    };
  }, [data, locale, t]);

  const accountEidolons = useMemo(() => {
    const result = new Map<string, number>();
    for (const character of account?.characters ?? [])
      result.set(
        canonicalCharacterId(character.definitionId),
        character.eidolon
      );
    return result;
  }, [account]);

  if (loading)
    return (
      <PageLayout>
        <ScrollLayout>
          <CatalogLoading />
        </ScrollLayout>
      </PageLayout>
    );
  if (error || !data || !items)
    return (
      <PageLayout>
        <ScrollLayout>
          <CatalogLoadError error={error} />
        </ScrollLayout>
      </PageLayout>
    );

  return (
    <PageLayout>
      <PageHeader titleKey="route.teamDamage.title" visuallyHidden />
      <ScrollLayout>
        {!team ? (
          <EmptyState messageKey="combat.team.empty" icon={Swords}>
            <Button onClick={() => createTeam()}>{t("combat.team.new")}</Button>
          </EmptyState>
        ) : (
          <div className="space-y-4 pb-6">
            <TeamToolbar team={team} teams={teams} />
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {team.members.map((plan, slot) => (
                <TeamMemberCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
                  key={slot}
                  slot={slot}
                  plan={plan}
                  outcome={
                    simulation.result?.members.find(
                      (member) =>
                        member.slot === slot &&
                        member.characterId === plan?.characterId
                    ) ?? undefined
                  }
                  accountEidolon={
                    plan
                      ? (accountEidolons.get(
                          canonicalCharacterId(plan.characterId)
                        ) ?? null)
                      : null
                  }
                  references={data}
                  items={items}
                  onCharacterChange={(characterId) =>
                    setMember(team.id, slot, characterId)
                  }
                  onChange={(patch) => updateMember(team.id, slot, patch)}
                />
              ))}
            </div>
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <DamageSummary
                result={simulation.result}
                running={simulation.running}
                failed={simulation.failed}
                cycles={team.cycles}
                references={data}
              />
              <CombatToolsPanel
                team={team}
                sources={sources}
                account={account}
                references={data}
              />
            </div>
          </div>
        )}
      </ScrollLayout>
    </PageLayout>
  );
}
