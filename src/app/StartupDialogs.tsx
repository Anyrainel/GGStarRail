import { Download, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NewsText } from "@/components/shared/NewsText";
import { UpdateHistorySheet } from "@/components/shared/UpdateHistorySheet";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildWorkspaceBundle } from "@/services/builds/bundle";
import { loadBuildPreset } from "@/services/builds/presets";
import { updateLogs } from "@/services/content/updateLog";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function hasBuildConfiguration(
  state: ReturnType<typeof useWorkspaceStore.getState>
) {
  return (
    state.builds.length > 0 ||
    state.scoreProfiles.length > 0 ||
    state.buildPresetSubscription !== null ||
    Object.entries(state.triageRules).some(
      ([key, value]) =>
        value !==
        DEFAULT_WORKSPACE.triageRules[key as keyof typeof state.triageRules]
    ) ||
    Object.values(state.characterLightConeIds).some((ids) => ids.length > 0)
  );
}

/** One startup dialog at a time; presets are always reviewed before subscription. */
export function StartupDialogs() {
  const { locale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const configured = useWorkspaceStore(hasBuildConfiguration);
  const promptSeen = useGreetingStore((state) => state.buildPromptSeen);
  const lastSeenUpdate = useGreetingStore((state) => state.lastSeenUpdate);
  const [dismissed, setDismissed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preset, setPreset] = useState<BuildWorkspaceBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const entry = updateLogs[locale].entries[0];
  const latestDate = entry?.date ?? null;
  const buildRoute =
    location.pathname.startsWith("/builds/") ||
    [
      APP_PATHS.recommendations,
      APP_PATHS.evaluation,
      APP_PATHS.resources,
      APP_PATHS.triage,
    ].some((path) => path === location.pathname);
  // Existing users with missing builds also receive this first-use prompt.
  // Respect an explicit dismissal across visits and page changes.
  const showBuilds =
    !configured &&
    !promptSeen &&
    (location.pathname === APP_PATHS.home || buildRoute);
  const showNews = Boolean(
    entry && latestDate && latestDate > (lastSeenUpdate ?? "")
  );
  const suppressedRoute = location.pathname === "/callback";

  useEffect(() => {
    if (configured && !promptSeen) {
      useGreetingStore.getState().dismissBuildPrompt(null);
    }
  }, [configured, promptSeen]);

  function dismissBuilds() {
    useGreetingStore.getState().dismissBuildPrompt(latestDate);
    setDismissed(true);
  }

  function dismissNews() {
    if (latestDate) useGreetingStore.getState().dismissUpdate(latestDate);
    setDismissed(true);
  }

  async function reviewPreset() {
    setLoading(true);
    setFailed(false);
    try {
      setPreset(await loadBuildPreset("in-game"));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function subscribe() {
    // Another tab, cloud restore, or an import can populate the workspace while
    // the preview is open. Never replace that work through the first-use flow.
    if (!preset || hasBuildConfiguration(useWorkspaceStore.getState())) return;
    useWorkspaceStore.getState().subscribeBuildPreset("in-game", preset);
    dismissBuilds();
  }

  return (
    <>
      {!dismissed && !suppressedRoute && showBuilds && (
        <ResponsiveDialog
          open
          onOpenChange={(open) => {
            if (!open) dismissBuilds();
          }}
        >
          <ResponsiveDialogContent
            closeLabel={t("common.close")}
            aria-describedby={undefined}
            className="md:w-[min(36rem,calc(100vw-2rem))]"
          >
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                {t("onboarding.buildTitle")}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="my-5 rounded-xl border border-border bg-gradient-card p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Download className="size-4 text-primary" aria-hidden />
                {t("build.presetInGame")}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background p-3 text-sm">
                  {t("onboarding.cavern")}
                  {preset && (
                    <strong className="mt-1 block text-lg tabular-nums">
                      {
                        preset.builds.filter(
                          (build) => build.category === "cavern"
                        ).length
                      }
                    </strong>
                  )}
                </div>
                <div className="rounded-lg bg-background p-3 text-sm">
                  {t("onboarding.planar")}
                  {preset && (
                    <strong className="mt-1 block text-lg tabular-nums">
                      {
                        preset.builds.filter(
                          (build) => build.category === "planar"
                        ).length
                      }
                    </strong>
                  )}
                </div>
              </div>
              {preset && (
                <p className="mt-3 text-sm">
                  {t("onboarding.subscriptionRule")}
                </p>
              )}
              {failed && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {t("onboarding.loadFailed")}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={dismissBuilds}>
                {t("onboarding.later")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  dismissBuilds();
                  navigate(APP_PATHS.builds);
                }}
              >
                {t("onboarding.customBuilds")}
              </Button>
              {preset ? (
                <Button onClick={subscribe}>{t("preset.subscribe")}</Button>
              ) : (
                <Button disabled={loading} onClick={() => void reviewPreset()}>
                  {loading ? t("common.loading") : t("onboarding.reviewPreset")}
                </Button>
              )}
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      )}
      {!dismissed && !suppressedRoute && !showBuilds && showNews && entry && (
        <ResponsiveDialog
          open
          onOpenChange={(open) => {
            if (!open) dismissNews();
          }}
        >
          <ResponsiveDialogContent
            closeLabel={t("common.close")}
            aria-describedby={undefined}
            className="flex flex-col overflow-hidden md:w-[min(38rem,calc(100vw-2rem))]"
          >
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="flex items-center gap-2">
                <Megaphone className="size-4 text-primary" aria-hidden />
                {t("whatsNew.latestTitle")}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="my-4 min-h-0 space-y-4 overflow-y-auto">
              <time
                className="font-mono text-sm font-semibold"
                dateTime={entry.date}
              >
                {entry.date}
              </time>
              {entry.sections.map((section) => (
                <section key={section.category}>
                  <h3 className="mb-2 text-sm font-semibold text-primary">
                    {section.category === "features"
                      ? t("whatsNew.features")
                      : t("whatsNew.fixes")}
                  </h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                    {section.items.map((item) => (
                      <li key={item}>
                        <NewsText onNavigate={dismissNews}>{item}</NewsText>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  dismissNews();
                  setHistoryOpen(true);
                }}
              >
                {t("whatsNew.history")}
              </Button>
              <Button onClick={dismissNews}>{t("whatsNew.gotIt")}</Button>
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      )}
      <UpdateHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
