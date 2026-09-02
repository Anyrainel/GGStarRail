import { Database, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AccountSnapshot, ImportCoverage } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";

function isPartial(account: AccountSnapshot): boolean {
  return Object.values(account.source.coverage).some(
    (coverage) => coverage !== "complete"
  );
}

export function AccountCoverageNotice({
  account,
}: {
  account: AccountSnapshot | null;
}) {
  const { locale, t } = useI18n();
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

  const providerLabel = () => {
    switch (account.source.provider) {
      case "scanner-export":
        return t("source.scanner");
      case "uid-showcase":
        return t("source.uidShowcase");
      case "hoyolab-account":
        return t("source.hoyolab");
      case "demo-account":
        return t("source.demo");
    }
  };

  const partial = isPartial(account);
  const Icon = partial ? TriangleAlert : Database;

  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/10 p-4"
      aria-labelledby="account-coverage-title"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-2">
          <div>
            <h2 id="account-coverage-title" className="text-sm font-semibold">
              {t("account.coverage.title")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {partial
                ? t("account.coverage.partialBody")
                : t("account.coverage.completeBody")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{providerLabel()}</Badge>
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
          <p className="text-xs text-muted-foreground">
            {t("field.importedAt", {
              value: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(account.source.importedAt)),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
