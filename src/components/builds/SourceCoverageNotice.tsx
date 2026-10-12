import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  AccountSnapshot,
  ImportCoverage,
} from "@/domain/game-account/schemas";
import { useI18n } from "@/i18n/I18nContext";

/** Flags partial imports; complete sources need no notice. */
export function SourceCoverageNotice({
  account,
}: {
  account: AccountSnapshot | null;
}) {
  const { t } = useI18n();
  const titleId = useId();
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

  const { coverage } = account.source;
  const partial = [
    {
      key: "characters",
      value: coverage.characters,
      text: t("imports.review.coverageCharacters", {
        coverage: coverageLabel(coverage.characters),
      }),
    },
    {
      key: "lightCones",
      value: coverage.lightCones,
      text: t("imports.review.coverageLightCones", {
        coverage: coverageLabel(coverage.lightCones),
      }),
    },
    {
      key: "relics",
      value: coverage.relics,
      text: t("imports.review.coverageRelics", {
        coverage: coverageLabel(coverage.relics),
      }),
    },
  ].filter((entry) => entry.value !== "complete");
  if (!partial.length) return null;

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card/10 px-3 py-2 text-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <TriangleAlert
          className="h-4 w-4 shrink-0 text-[hsl(var(--quality-gold))]"
          aria-hidden="true"
        />
        <h2 id={titleId} className="font-semibold">
          {t("build.coverageNoticeTitle")}
        </h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {partial.map((entry) => (
          <Badge key={entry.key} variant="outline" className="font-medium">
            {entry.text}
          </Badge>
        ))}
      </div>
    </section>
  );
}
