import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function CatalogLoading() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-border bg-card/65 text-sm text-muted-foreground">
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
      className="rounded-xl border border-destructive/45 bg-destructive/10 p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="font-semibold">{t("archive.loadError.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("archive.loadError.hint")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CatalogEmpty() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {t("empty.filtered")}
    </div>
  );
}
