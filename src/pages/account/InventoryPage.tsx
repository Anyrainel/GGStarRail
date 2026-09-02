import { Boxes, Gem, Sparkles, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import { relicCategory } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function InventoryPage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const cavernCount =
    account?.relics.filter((relic) => relicCategory(relic.slot) === "cavern")
      .length ?? 0;
  const planarCount = (account?.relics.length ?? 0) - cavernCount;
  const summaries = [
    {
      label: t("nav.lightCones"),
      count: account?.lightCones.length ?? 0,
      icon: WandSparkles,
      path: APP_PATHS.lightCones,
    },
    {
      label: t("nav.relics"),
      count: cavernCount,
      icon: Gem,
      path: APP_PATHS.relics,
    },
    {
      label: t("nav.planarOrnaments"),
      count: planarCount,
      icon: Sparkles,
      path: APP_PATHS.planarOrnaments,
    },
  ];
  return (
    <>
      <PageHeader
        titleKey="route.inventory.title"
        descriptionKey="route.inventory.description"
      />
      <AccountCoverageNotice account={account} />
      {!account ? (
        <WorkspaceStartState messageKey="empty.inventory" icon={Boxes} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-3">
          {summaries.map(({ label, count, icon: Icon, path }) => (
            <Link
              key={path}
              to={path}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-primary/45 hover:bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{count}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
