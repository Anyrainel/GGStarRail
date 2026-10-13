import { RefreshCw } from "lucide-react";
import { StatusBanner } from "@/components/shared/StatusBanner";
import { Button } from "@/components/ui/button";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { useI18n } from "@/i18n/I18nContext";

/** Resolve subscribed files at startup, including outside their editing pages. */
export function PresetSubscriptions() {
  const builds = useHydrateBuildPreset();
  const teams = useHydrateTeamPreset();
  const { t } = useI18n();
  if (!builds.failed && !teams.failed) return null;
  return (
    <div className="wide-container flex shrink-0 items-center gap-2 pb-2">
      <StatusBanner
        message={t("preset.updateFailed")}
        tone="error"
        className="flex-1"
      />
      <Button
        variant="outline"
        onClick={() => {
          if (builds.failed) builds.retry();
          if (teams.failed) teams.retry();
        }}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {t("preset.retry")}
      </Button>
    </div>
  );
}
