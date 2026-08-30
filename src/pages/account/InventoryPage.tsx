import { Boxes, Gem, Sparkles, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import { relicCategory } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function InventoryPage() {
  const { locale, t } = useI18n();
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
      {account && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            {account.source.provider === "demo-account"
              ? t("source.demo")
              : account.source.provider}
          </Badge>
          <span>
            {t("field.importedAt", {
              value: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(account.source.importedAt)),
            })}
          </span>
        </div>
      )}
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
      {!account && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="min-w-48 flex-1">{t("empty.inventory")}</span>
          <Button asChild size="sm" variant="outline">
            <Link to={APP_PATHS.imports}>{t("nav.imports")}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
