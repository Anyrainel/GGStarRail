import { AlertTriangle, LoaderCircle, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface CatalogSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholderKey: MessageKey;
}

export function CatalogSearch({
  value,
  onChange,
  placeholderKey,
}: CatalogSearchProps) {
  const { t } = useI18n();
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{t("common.search")}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t(placeholderKey)}
        className="h-11 w-full rounded-lg border border-border bg-background/75 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

interface CatalogSelectProps {
  labelKey: MessageKey;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

export function CatalogSelect({
  labelKey,
  value,
  onChange,
  children,
}: CatalogSelectProps) {
  const { t } = useI18n();
  return (
    <label className="grid min-w-36 gap-1 text-xs font-medium text-muted-foreground">
      <span>{t(labelKey)}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-background/75 px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
      >
        {children}
      </select>
    </label>
  );
}

export function CatalogLoading() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-border bg-card/65 text-sm text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      {t("archive.loading")}
    </div>
  );
}

export function CatalogFailure({ error }: { error: Error }) {
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
          <code className="block break-all rounded-md bg-background/60 p-2 text-xs text-muted-foreground">
            {error.message}
          </code>
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
