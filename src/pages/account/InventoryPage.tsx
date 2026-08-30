import { Boxes, Gem, Sparkles, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    },
    { label: t("nav.relics"), count: cavernCount, icon: Gem },
    {
      label: t("nav.planarOrnaments"),
      count: planarCount,
      icon: Sparkles,
    },
  ];
  return (
    <>
      <PageHeader
        titleKey="route.inventory.title"
        descriptionKey="route.inventory.description"
      />
      <section className="grid gap-4 sm:grid-cols-3">
        {summaries.map(({ label, count, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{label}</CardTitle>
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {!account && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("empty.inventory")}
        </div>
      )}
    </>
  );
}
