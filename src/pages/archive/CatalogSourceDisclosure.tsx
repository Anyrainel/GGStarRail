import { useI18n } from "@/i18n/I18nContext";

export function CatalogSourceDisclosure({
  revision,
  path,
}: {
  revision: string;
  path: string;
}) {
  const { t } = useI18n();

  return (
    <details className="rounded-lg border border-border bg-background/45 p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        {t("archive.sourceDetails")}
      </summary>
      <div className="mt-3">
        <p>{t("archive.provenance.primary")}</p>
        <code className="mt-1 block break-all">{revision}</code>
        <p className="mt-2 break-all">{path}</p>
      </div>
    </details>
  );
}
