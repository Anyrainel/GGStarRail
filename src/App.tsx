import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { routeDefinition } from "@/app/routeRegistry";
import { AppShell } from "@/components/layout/AppShell";
import { PRODUCT_NAME } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import CharactersPage from "@/pages/account/CharactersPage";
import InventoryPage from "@/pages/account/InventoryPage";
import LightConesPage from "@/pages/account/LightConesPage";
import RelicsPage from "@/pages/account/RelicsPage";
import ArchivePage from "@/pages/archive/ArchivePage";
import BuildsPage from "@/pages/builds/BuildsPage";
import FiltersPage from "@/pages/builds/FiltersPage";
import ScoringPage from "@/pages/builds/ScoringPage";
import TriagePage from "@/pages/builds/TriagePage";
import DataSourcesPage from "@/pages/DataSourcesPage";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";

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
        <Route path={APP_PATHS.characters} element={<CharactersPage />} />
        <Route path={APP_PATHS.inventory} element={<InventoryPage />} />
        <Route path={APP_PATHS.lightCones} element={<LightConesPage />} />
        <Route
          path={APP_PATHS.relics}
          element={
            <RelicsPage
              category="cavern"
              titleKey="route.relics.title"
              descriptionKey="route.relics.description"
              emptyKey="empty.relics"
            />
          }
        />
        <Route
          path={APP_PATHS.planarOrnaments}
          element={
            <RelicsPage
              category="planar"
              titleKey="route.planar.title"
              descriptionKey="route.planar.description"
              emptyKey="empty.planar"
            />
          }
        />
        <Route
          path="/builds"
          element={<Navigate to={APP_PATHS.builds} replace />}
        />
        <Route path={APP_PATHS.builds} element={<BuildsPage />} />
        <Route path={APP_PATHS.scoring} element={<ScoringPage />} />
        <Route path={APP_PATHS.filters} element={<FiltersPage />} />
        <Route path={APP_PATHS.triage} element={<TriagePage />} />
        <Route
          path="/builds/triage"
          element={<Navigate to={APP_PATHS.triage} replace />}
        />
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
