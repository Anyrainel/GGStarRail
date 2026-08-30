import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function BuildsPage() {
  const { t } = useI18n();
  const builds = useWorkspaceStore((state) => state.builds);
  return (
    <>
      <PageHeader
        titleKey="route.builds.title"
        descriptionKey="route.builds.description"
      />
      {builds.length === 0 ? (
        <EmptyState messageKey="empty.builds" icon={SlidersHorizontal} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {builds.map((build) => (
            <Card key={build.id}>
              <CardHeader>
                <CardTitle>{build.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">
                  {t("field.target", {
                    value: build.characterDefinitionId,
                  })}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}
