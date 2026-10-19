import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { PresetSubscriptions } from "@/app/PresetSubscriptions";
import { routeDefinition } from "@/app/routeRegistry";
import { PRODUCT_NAME } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";

const CharacterView = lazy(() => import("@/pages/game-account/CharacterView"));
const InventoryView = lazy(() => import("@/pages/game-account/InventoryView"));
const ScoreUpView = lazy(() =>
  import("@/pages/game-account/ScoreUpView").then((module) => ({
    default: module.ScoreUpView,
  }))
);
const EvaluationView = lazy(() =>
  import("@/pages/game-account/EvaluationView").then((module) => ({
    default: module.EvaluationView,
  }))
);
const ResourceView = lazy(() =>
  import("@/pages/game-account/ResourceView").then((module) => ({
    default: module.ResourceView,
  }))
);
const TriageView = lazy(() =>
  import("@/pages/game-account/TriageView").then((module) => ({
    default: module.TriageView,
  }))
);
const ArchivePage = lazy(() => import("@/pages/archive/ArchivePage"));
const ScannerDownloadPage = lazy(() => import("@/pages/ScannerDownloadPage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const SupportPage = lazy(() => import("@/pages/SupportPage"));
const RelicFiltersView = lazy(() => import("@/pages/builds/RelicFiltersView"));
const CharacterBuildView = lazy(
  () => import("@/pages/builds/CharacterBuildView")
);
const TeamDamagePage = lazy(() => import("@/pages/teams/TeamDamagePage"));
const CharacterTierListView = lazy(
  () => import("@/pages/tier-list/CharacterTierListView")
);
const LightConeTierListView = lazy(
  () => import("@/pages/tier-list/LightConeTierListView")
);
const RelicTierListView = lazy(
  () => import("@/pages/tier-list/RelicTierListView")
);

/** Redirects with `replace`, keeping the query string (e.g. `?team=`). */
function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function LegacyTeamAnalysis({ mode }: { mode: string }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("mode", mode);
  return <Navigate replace to={`${APP_PATHS.teamDamage}?${params}`} />;
}

export default function App() {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const route = routeDefinition(location.pathname);
    const title =
      location.pathname === "/callback"
        ? t("auth.signIn")
        : route
          ? t(route.titleKey)
          : t("route.notFound.title");
    const description = route
      ? t(route.descriptionKey)
      : t("route.notFound.description");
    document.title = `${title} — ${PRODUCT_NAME}`;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", description);
  }, [location.pathname, t]);

  return (
    <AppShell>
      <PresetSubscriptions />
      <Suspense
        fallback={
          <p role="status" className="p-6">
            {t("common.loading")}
          </p>
        }
      >
        <Routes>
          <Route path={APP_PATHS.feedback} element={<FeedbackPage />} />
          <Route path="/account/feedback" element={<FeedbackPage />} />
          <Route path={APP_PATHS.support} element={<SupportPage />} />
          <Route path="/callback" element={<AuthCallbackPage />} />
          <Route
            path={APP_PATHS.scannerDownload}
            element={<ScannerDownloadPage />}
          />
          <Route path={APP_PATHS.home} element={<HomePage />} />
          <Route
            path="/account-data"
            element={<Navigate to={APP_PATHS.characters} replace />}
          />
          <Route path={APP_PATHS.characters} element={<CharacterView />} />
          <Route path={APP_PATHS.inventory} element={<InventoryView />} />
          <Route path={APP_PATHS.recommendations} element={<ScoreUpView />} />
          <Route path={APP_PATHS.evaluation} element={<EvaluationView />} />
          <Route path={APP_PATHS.resources} element={<ResourceView />} />
          <Route
            path="/account-data/light-cones"
            element={<Navigate to={APP_PATHS.inventory} replace />}
          />
          <Route
            path="/account-data/relics"
            element={<Navigate to={APP_PATHS.inventory} replace />}
          />
          <Route
            path="/account-data/planar-ornaments"
            element={<Navigate to={APP_PATHS.inventory} replace />}
          />
          <Route
            path="/builds"
            element={<Navigate to={APP_PATHS.builds} replace />}
          />
          <Route path={APP_PATHS.builds} element={<CharacterBuildView />} />
          <Route path={APP_PATHS.filters} element={<RelicFiltersView />} />
          <Route path={APP_PATHS.triage} element={<TriageView />} />
          <Route path={APP_PATHS.teamDamage} element={<TeamDamagePage />} />
          <Route
            path={APP_PATHS.teamInvestment}
            element={<LegacyTeamAnalysis mode="investment" />}
          />
          <Route
            path={APP_PATHS.teamChoice}
            element={<LegacyTeamAnalysis mode="builds" />}
          />
          <Route
            path="/team-damage"
            element={<RedirectWithSearch to={APP_PATHS.teamDamage} />}
          />
          <Route
            path="/team-damage/optimizer"
            element={<LegacyTeamAnalysis mode="relics" />}
          />
          <Route
            path="/team-damage/*"
            element={<RedirectWithSearch to={APP_PATHS.teamDamage} />}
          />
          <Route
            path="/builds/team-damage"
            element={<RedirectWithSearch to={APP_PATHS.teamDamage} />}
          />
          <Route
            path="/builds/scoring"
            element={<Navigate to={APP_PATHS.builds} replace />}
          />
          <Route
            path="/builds/triage"
            element={<Navigate to={APP_PATHS.triage} replace />}
          />
          <Route
            path="/tier-list"
            element={<Navigate to={APP_PATHS.tierCharacters} replace />}
          />
          <Route
            path={APP_PATHS.tierCharacters}
            element={<CharacterTierListView />}
          />
          <Route
            path={APP_PATHS.tierLightCones}
            element={<LightConeTierListView />}
          />
          <Route path={APP_PATHS.tierRelics} element={<RelicTierListView />} />
          <Route
            path="/archive"
            element={<Navigate to={APP_PATHS.archiveCharacters} replace />}
          />
          <Route
            path={APP_PATHS.archiveCharacters}
            element={
              <ArchivePage
                kind="characters"
                titleKey="route.archiveCharacters.title"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveLightCones}
            element={
              <ArchivePage
                kind="lightCones"
                titleKey="route.archiveLightCones.title"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveRelicSets}
            element={
              <ArchivePage
                kind="relicSets"
                titleKey="route.archiveRelicSets.title"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveAchievements}
            element={
              <ArchivePage
                kind="achievements"
                titleKey="route.archiveAchievements.title"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveCurrencyWar}
            element={
              <ArchivePage
                kind="currencyWar"
                titleKey="route.archiveCurrencyWar.title"
              />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
