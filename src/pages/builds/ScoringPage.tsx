import { CircleGauge } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function ScoringPage() {
  const { t } = useI18n();
  const count = useWorkspaceStore((state) => state.scoreProfiles.length);
  return (
    <>
      <PageHeader
        titleKey="route.scoring.title"
        descriptionKey="route.scoring.description"
      />
      <div className="max-w-2xl">
        <StatusCard
          titleKey="scoring.engine.title"
          bodyKey="scoring.engine.body"
          statusKey="status.scaffolded"
          status="scaffolded"
          icon={CircleGauge}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t("common.count", { count })}
      </p>
    </>
  );
}
