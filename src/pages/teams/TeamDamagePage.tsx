import type { ReactNode } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChoiceDetail } from "@/components/teams/choice/ChoiceDetail";
import { InvestmentDetail } from "@/components/teams/investment/InvestmentDetail";
import { OptimizerDetail } from "@/components/teams/optimizer/OptimizerDetail";
import { TeamDmgDataProvider } from "@/components/teams/team/TeamDmgData";
import { TeamGrid } from "@/components/teams/team/TeamGrid";
import {
  TEAM_DMG_TABS,
  type TeamDetailProps,
  type TeamDmgTab,
} from "@/components/teams/team/types";
import { useTeamParam } from "@/components/teams/team/useTeamParam";
import { useBuildReferences } from "@/hooks/useCatalogReferences";

const DETAILS: Record<TeamDmgTab, (props: TeamDetailProps) => ReactNode> = {
  optimizer: OptimizerDetail,
  investment: InvestmentDetail,
  choice: ChoiceDetail,
};

function TeamDamageContent({ tab }: { tab: TeamDmgTab }) {
  const { team, openTeam, closeTeam } = useTeamParam();
  if (team) {
    const Detail = DETAILS[tab];
    return <Detail key={`${tab}:${team.id}`} team={team} onBack={closeTeam} />;
  }
  return <TeamGrid key={tab} tab={tab} onOpen={openTeam} />;
}

/**
 * Team DMG: one page per tab (DMG Optimizer, Investment, Light Cone & Relic
 * Choice). Each shows the team grid, or the tab's detail for `?team=`.
 */
export default function TeamDamagePage({ tab }: { tab: TeamDmgTab }) {
  const { data, error, loading } = useBuildReferences();
  return (
    <PageLayout>
      <PageHeader titleKey={TEAM_DMG_TABS[tab].titleKey} visuallyHidden />
      {loading ? (
        <ScrollLayout>
          <CatalogLoading />
        </ScrollLayout>
      ) : error || !data ? (
        <ScrollLayout>
          <CatalogLoadError error={error} />
        </ScrollLayout>
      ) : (
        <TeamDmgDataProvider references={data}>
          <TeamDamageContent tab={tab} />
        </TeamDmgDataProvider>
      )}
    </PageLayout>
  );
}
