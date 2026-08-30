import { WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function LightConesPage() {
  const { t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const lightCones = account?.lightCones ?? [];
  return (
    <>
      <PageHeader
        titleKey="route.lightCones.title"
        descriptionKey="route.lightCones.description"
      />
      {lightCones.length === 0 ? (
        <EmptyState messageKey="empty.lightCones" icon={WandSparkles} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lightCones.map((lightCone) => (
            <Card key={lightCone.key}>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  {lightCone.definitionId}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>{t("field.level", { value: lightCone.level })}</Badge>
                <Badge variant="secondary">
                  {t("field.superimposition", {
                    value: lightCone.superimposition,
                  })}
                </Badge>
                <Badge variant="outline">
                  {t("field.path", { value: lightCone.pathId })}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}
