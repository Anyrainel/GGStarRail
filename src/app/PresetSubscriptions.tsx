import { useEffect } from "react";
import { toast } from "sonner";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { useI18n } from "@/i18n/I18nContext";

/** Resolve subscribed files at startup, including outside their editing pages. */
export function PresetSubscriptions() {
  const builds = useHydrateBuildPreset();
  const teams = useHydrateTeamPreset();
  const { t } = useI18n();
  useEffect(() => {
    if (!builds.failed && !teams.failed) return;
    const id = toast.error(t("preset.updateFailed"), {
      duration: Infinity,
      action: {
        label: t("preset.retry"),
        onClick: () => {
          if (builds.failed) builds.retry();
          if (teams.failed) teams.retry();
        },
      },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [builds.failed, builds.retry, teams.failed, teams.retry, t]);
  return null;
}
