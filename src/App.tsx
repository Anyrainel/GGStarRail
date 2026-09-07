import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { routeDefinition } from "@/app/routeRegistry";
import { AppShell } from "@/components/layout/AppShell";
import { PRODUCT_NAME } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";

const CharacterView = lazy(() => import("@/pages/account-data/CharacterView"));
const InventoryView = lazy(() => import("@/pages/account-data/InventoryView"));
const ResourceView = lazy(() =>
  import("@/pages/account-data/ResourceView").then((module) => ({
    default: module.ResourceView,
  }))
);
const TriageView = lazy(() =>
  import("@/pages/account-data/TriageView").then((module) => ({
    default: module.TriageView,
  }))
);
const ArchivePage = lazy(() => import("@/pages/archive/ArchivePage"));
const ArtifactBuildsView = lazy(
  () => import("@/pages/artifact-builds/ArtifactBuildsView")
);
const CharacterBuildView = lazy(
  () => import("@/pages/artifact-builds/CharacterBuildView")
);
const DataSourcesPage = lazy(() => import("@/pages/DataSourcesPage"));
const CharacterTierListView = lazy(
  () => import("@/pages/tier-list/CharacterTierListView")
);
const LightConeTierListView = lazy(
  () => import("@/pages/tier-list/LightConeTierListView")
);
const RelicTierListView = lazy(
  () => import("@/pages/tier-list/RelicTierListView")
);

export default function App() {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const route = routeDefinition(location.pathname);
    const title = route ? t(route.titleKey) : t("route.notFound.title");
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
      <Suspense
        fallback={
          <p role="status" className="p-6">
            {t("common.loading")}
          </p>
        }
      >
        <Routes>
          <Route path={APP_PATHS.home} element={<HomePage />} />
          <Route
            path="/account-data"
            element={<Navigate to={APP_PATHS.characters} replace />}
          />
          <Route path={APP_PATHS.characters} element={<CharacterView />} />
          <Route path={APP_PATHS.inventory} element={<InventoryView />} />
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
          <Route path={APP_PATHS.filters} element={<ArtifactBuildsView />} />
          <Route path={APP_PATHS.triage} element={<TriageView />} />
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
                descriptionKey="route.archiveCharacters.description"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveLightCones}
            element={
              <ArchivePage
                kind="lightCones"
                titleKey="route.archiveLightCones.title"
                descriptionKey="route.archiveLightCones.description"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveRelicSets}
            element={
              <ArchivePage
                kind="relicSets"
                titleKey="route.archiveRelicSets.title"
                descriptionKey="route.archiveRelicSets.description"
              />
            }
          />
          <Route
            path={APP_PATHS.archiveAchievements}
            element={
              <ArchivePage
                kind="achievements"
                titleKey="route.archiveAchievements.title"
                descriptionKey="route.archiveAchievements.description"
              />
            }
          />
          <Route path={APP_PATHS.imports} element={<DataSourcesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
