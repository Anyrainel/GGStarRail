import { HoverCard } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { GradeBadge } from "@/components/shared/FieldControls";
import type { RelicScore } from "@/domain/build/scoring";
import type { Relic } from "@/domain/game-account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";

export function RelicScoreHoverCard({
  children,
  relics,
  scores,
  references,
  locale,
  targetName,
}: {
  children: ReactNode;
  relics: readonly Relic[];
  scores: ReadonlyMap<string, RelicScore>;
  references: BuildReferences;
  locale: Locale;
  targetName: string;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const open = hovered || pinned;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !content.current?.contains(event.target)
      ) {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setHovered}
      openDelay={200}
      closeDelay={150}
    >
      <HoverCard.Trigger
        asChild
        onFocus={(event) => {
          event.preventDefault();
          setHovered(true);
        }}
        onBlur={(event) => {
          event.preventDefault();
          setHovered(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          aria-label={t("scoring.breakdown")}
          aria-expanded={open}
          className="rounded-md text-right outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setPinned(!pinned);
            setHovered(false);
          }}
        >
          {children}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          ref={content}
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[100] max-h-[min(28rem,var(--radix-hover-card-content-available-height))] w-96 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
          onEscapeKeyDown={() => {
            setPinned(false);
            setHovered(false);
          }}
        >
          <h3 className="font-semibold">{t("scoring.breakdown")}</h3>
          {targetName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("characterLoadout.buildTarget", { name: targetName })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("characterLoadout.scoredCount", { count: scores.size })}
          </p>
          <div className="mt-3 space-y-2">
            {relics.map((relic) => {
              const score = scores.get(relic.key);
              if (!score) return null;
              const slot = references.properties.relicSlotById.get(
                CATALOG_RELIC_SLOT[relic.slot]
              );
              return (
                <details
                  key={relic.key}
                  className="rounded-lg border border-border p-2"
                  data-relic-score={relic.key}
                >
                  <summary className="cursor-pointer text-sm">
                    <span className="ml-1 inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-2">
                      <span>
                        {localizedName(slot?.name, locale, relic.slot)}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <GradeBadge grade={score.grade} />
                        {score.total.toFixed(1)}
                      </span>
                    </span>
                  </summary>
                  {!score.mainStatAccepted && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("scoring.offTargetMain")}
                    </p>
                  )}
                  <dl className="mt-2 space-y-1 text-xs tabular-nums">
                    <div className="flex justify-between gap-2">
                      <dt>{t("scoring.mainStatScore")}</dt>
                      <dd>{score.mainStatScore.toFixed(1)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t("scoring.substatScore")}</dt>
                      <dd>{score.substatScore.toFixed(1)}</dd>
                    </div>
                    {Object.entries(score.contributions).map(
                      ([statId, contribution]) => (
                        <div
                          key={statId}
                          className="flex justify-between gap-2 text-muted-foreground"
                        >
                          <dt>
                            {localizedPropertyName(
                              statId,
                              references.properties,
                              locale
                            )}
                          </dt>
                          <dd>{contribution.score.toFixed(1)}</dd>
                        </div>
                      )
                    )}
                  </dl>
                </details>
              );
            })}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
