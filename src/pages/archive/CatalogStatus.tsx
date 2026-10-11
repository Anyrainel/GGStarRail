import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function CatalogLoading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
    >
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      {t("archive.loading")}
    </div>
  );
}

export function CatalogFailure(_: { error: Error }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="mx-auto max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h2 className="font-medium">{t("archive.loadError.title")}</h2>
          <p className="text-muted-foreground">{t("archive.loadError.hint")}</p>
        </div>
      </div>
    </div>
  );
}

export function CatalogEmpty() {
  const { t } = useI18n();
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {t("empty.filtered")}
    </p>
  );
}
