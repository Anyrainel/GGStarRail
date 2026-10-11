import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import type { MessageKey } from "@/i18n/messages.en";

/** Catalog loading or failure inside the page frame; the route keeps its h1. */
export function TierCatalogState({
  titleKey,
  loading,
  error,
}: {
  titleKey: MessageKey;
  loading: boolean;
  error: unknown;
}) {
  return (
    <PageLayout>
      <PageHeader titleKey={titleKey} visuallyHidden />
      <ScrollLayout>
        {loading ? <CatalogLoading /> : <CatalogLoadError error={error} />}
      </ScrollLayout>
    </PageLayout>
  );
}
