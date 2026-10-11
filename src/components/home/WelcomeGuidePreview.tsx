import { Check, FileJson, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

// Examples stay independent of account data and saved settings.
export function WelcomeGuidePreview({
  kind,
}: {
  kind: "account" | "builds" | "filters" | "decisions";
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const sources = [
    {
      title: t("imports.account.title"),
      icon: FileJson,
      detail: t("guide.preview.json"),
    },
    {
      title: t("imports.uid.title"),
      icon: Smartphone,
      detail: t("guide.preview.uid"),
    },
  ];
  const decisions = [
    {
      title: t("nav.triage"),
      labels: [t("triage.keep"), t("triage.review"), t("triage.salvageReview")],
      detail: t("guide.preview.triage"),
    },
    {
      title: t("nav.resources"),
      labels: [
        t("resource.action.levelUp"),
        t("resource.action.synthesize"),
        t("resource.action.reroll"),
      ],
      detail: t("guide.preview.resources"),
    },
  ];
  const weights = [
    {
      stat: t("guide.preview.speed"),
      value: 100,
      meaning: t("guide.preview.coreStat"),
    },
    {
      stat: t("guide.preview.break"),
      value: 80,
      meaning: t("guide.preview.desiredStat"),
    },
    {
      stat: t("guide.preview.hp"),
      value: 30,
      meaning: t("guide.preview.scoreOnly"),
    },
  ];
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-gradient-card">
      <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3 text-xs">
        <span className="font-semibold">{t("guide.preview.title")}</span>
        <span className="text-muted-foreground">
          {t("guide.preview.example")}
        </span>
      </figcaption>
      <div className="space-y-4 p-4">
        {kind === "account" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {sources.map((source, index) => (
                <button
                  key={source.title}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-2 rounded-lg border p-3 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === index
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <source.icon className="size-5 text-primary" aria-hidden />
                  {source.title}
                </button>
              ))}
            </div>
            <p className="text-sm leading-6">{sources[selected].detail}</p>
          </>
        )}
        {kind === "builds" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[t("build.cavernCards"), t("build.planarCards")].map(
                (label, index) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border bg-background/50 p-3"
                  >
                    <p className="text-xs font-medium">{label}</p>
                    <p className="mt-2 text-sm font-semibold">
                      {index === 0
                        ? t("build.cavernFourPiece")
                        : t("build.planarTwoPiece")}
                    </p>
                  </div>
                )
              )}
            </div>
            <p className="text-sm font-semibold">{t("scoring.weightsTitle")}</p>
            <div className="space-y-3">
              {weights.map(({ stat, value, meaning }) => (
                <div key={stat}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span>{stat}</span>
                    <span className="tabular-nums">{value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs leading-5">{meaning}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {kind === "filters" && (
          <>
            <p className="text-sm font-semibold">{t("guide.preview.match")}</p>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="text-xs font-medium">{t("guide.preview.body")}</p>
              <p className="mt-2 text-sm leading-6">
                {t("guide.preview.relicStats")}
              </p>
            </div>
            <div className="space-y-2">
              {[t("filters.reason.set"), t("filters.reason.mainStat")].map(
                (label) => (
                  <p key={label} className="flex items-start gap-2 text-sm">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    {label}
                  </p>
                )
              )}
              <p className="flex items-start gap-2 text-sm">
                <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("guide.preview.missingSpeed")}
              </p>
            </div>
            <p className="border-t border-border pt-3 text-sm leading-6">
              {t("guide.preview.filterResult")}
            </p>
          </>
        )}
        {kind === "decisions" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {decisions.map((decision, index) => (
                <button
                  key={decision.title}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className={cn(
                    "min-h-11 rounded-lg border px-2 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === index
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {decision.title}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {decisions[selected].labels.map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-border bg-background/50 px-2 py-1.5 text-xs"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="text-sm leading-6">{decisions[selected].detail}</p>
          </>
        )}
      </div>
    </figure>
  );
}
