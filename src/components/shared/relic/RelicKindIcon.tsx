import { Gem, Orbit } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { RelicKind } from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";

/** Gem marks Cavern Relics and Orbit marks Planar Ornaments, as on Relic Priority. */
export const RELIC_KIND_ICONS = { cavern: Gem, planar: Orbit } as const;

export function RelicKindIcon({
  kind,
  className,
  decorative = false,
}: {
  kind: RelicKind;
  className?: string;
  /** Hide from assistive technology when a visible label already names the kind. */
  decorative?: boolean;
}) {
  const { t } = useI18n();
  const Icon = RELIC_KIND_ICONS[kind];
  const label = t(
    kind === "cavern" ? "relic.kind.cavern" : "relic.kind.planar"
  );
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", className)}
      data-relic-kind-icon={kind}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    />
  );
}
