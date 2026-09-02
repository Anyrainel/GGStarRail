import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AccountSnapshot, ImportCoverage } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";

export function SourceCoverageNotice({
  account,
}: {
  account: AccountSnapshot | null;
}) {
  const { t } = useI18n();
  if (!account) return null;

  const coverageLabel = (coverage: ImportCoverage) => {
    switch (coverage) {
      case "complete":
        return t("imports.coverage.complete");
      case "equipped-only":
        return t("imports.coverage.equipped-only");
      case "showcase-only":
        return t("imports.coverage.showcase-only");
      case "unknown":
        return t("imports.coverage.unknown");
    }
  };

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-2">
          <div>
            <h2 className="text-sm font-semibold">
              {t("build.coverageNoticeTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("build.coverageNoticeBody")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t("imports.review.coverageCharacters", {
                coverage: coverageLabel(account.source.coverage.characters),
              })}
            </Badge>
            <Badge variant="outline">
              {t("imports.review.coverageLightCones", {
                coverage: coverageLabel(account.source.coverage.lightCones),
              })}
            </Badge>
            <Badge variant="outline">
              {t("imports.review.coverageRelics", {
                coverage: coverageLabel(account.source.coverage.relics),
              })}
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
