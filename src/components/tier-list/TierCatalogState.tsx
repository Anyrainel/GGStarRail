import { WideLayout } from "@/components/layout/WideLayout";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/shared/CatalogLoadState";
import type { TierDocument } from "@/domain/tier-list/document";
import { useI18n } from "@/i18n/I18nContext";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";
import { TIER_ROUTE_TITLE, TierTitleActions } from "./TierToolbar";

/**
 * Catalog loading or failure under the list's own title row, with its
 * actions disabled, in the body inset the grid uses.
 */
export function TierCatalogState({
  category,
  loading,
  error,
}: {
  category: TierDocument["category"];
  loading: boolean;
  error: unknown;
}) {
  const { t } = useI18n();
  const savedTitle = useTierLibraryStore((state) => {
    const id = state.active[category];
    return id ? state.documents[id]?.presentation.title : undefined;
  });

  return (
    <WideLayout
      title={savedTitle || t(TIER_ROUTE_TITLE[category])}
      actions={<TierTitleActions />}
    >
      <div className="p-4">
        {loading ? <CatalogLoading /> : <CatalogLoadError error={error} />}
      </div>
    </WideLayout>
  );
}
