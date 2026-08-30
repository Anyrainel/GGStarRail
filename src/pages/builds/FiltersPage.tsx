import { Filter } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusCard } from "@/components/shared/StatusCard";
import { useI18n } from "@/i18n/I18nContext";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function FiltersPage() {
  const { t } = useI18n();
  const count = useWorkspaceStore((state) => state.computedFilters.length);
  return (
    <>
      <PageHeader
        titleKey="route.filters.title"
        descriptionKey="route.filters.description"
      />
      <div className="max-w-2xl">
        <StatusCard
          titleKey="filters.engine.title"
          bodyKey="filters.engine.body"
          statusKey="status.implemented"
          status="implemented"
          icon={Filter}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t("common.count", { count })}
      </p>
    </>
  );
}
