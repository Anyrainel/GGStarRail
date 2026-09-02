import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { routeDefinition } from "@/app/routeRegistry";
import { AppShell } from "@/components/layout/AppShell";
import { PRODUCT_NAME } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import CharacterView from "@/pages/account-data/CharacterView";
import InventoryView from "@/pages/account-data/InventoryView";
import { ResourceView } from "@/pages/account-data/ResourceView";
import { TriageView } from "@/pages/account-data/TriageView";
import ArchivePage from "@/pages/archive/ArchivePage";
import ArtifactBuildsView from "@/pages/artifact-builds/ArtifactBuildsView";
import CharacterBuildView from "@/pages/artifact-builds/CharacterBuildView";
import DataSourcesPage from "@/pages/DataSourcesPage";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import CharacterTierListView from "@/pages/tier-list/CharacterTierListView";
import LightConeTierListView from "@/pages/tier-list/LightConeTierListView";
import RelicTierListView from "@/pages/tier-list/RelicTierListView";

export default function App() {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const route = routeDefinition(location.pathname);
    document.title = route
      ? `${t(route.titleKey)} — ${PRODUCT_NAME}`
      : `${t("route.notFound.title")} — ${PRODUCT_NAME}`;
  }, [location.pathname, t]);

  return (
    <AppShell>
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
        <Route path={APP_PATHS.imports} element={<DataSourcesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
