import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { redactDiagnostic } from "@/lib/security";

export function CatalogLoading() {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden />
      {t("common.loading")}
    </div>
  );
}

export function CatalogLoadError({ error }: { error: unknown }) {
  const { t } = useI18n();
  return (
    <div
      className="space-y-2 rounded-xl border border-destructive/50 bg-destructive/10 p-5"
      role="alert"
    >
      <div className="flex items-center gap-3 text-sm font-medium">
        <TriangleAlert className="h-5 w-5 text-destructive" aria-hidden />
        {t("error.catalogLoad")}
      </div>
      <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground select-text">
        {redactDiagnostic(error)}
      </pre>
    </div>
  );
}
