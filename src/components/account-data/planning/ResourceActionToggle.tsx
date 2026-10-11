import { useId } from "react";
import { Checkbox } from "@/components/shared/Checkbox";
import type { ResourceActionKind } from "@/domain/resources/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { CompactNumberInput } from "./CompactNumberInput";
import { RESOURCE_ACTION } from "./resourcePresentation";

/** Toolbar tile: show an action, its suggestion count, and its headroom threshold. */
export function ResourceActionToggle({
  kind,
  enabled,
  count,
  threshold,
  onEnabledChange,
  onThresholdChange,
}: {
  kind: ResourceActionKind;
  enabled: boolean;
  count: number;
  threshold: number;
  onEnabledChange: (enabled: boolean) => void;
  onThresholdChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const action = RESOURCE_ACTION[kind];
  const Icon = action.icon;
  const label = t(action.labelKey);
  const thresholdLabel = t("resource.thresholdFor", { action: label });

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-border bg-gradient-card px-2 py-1.5 transition-colors hover:bg-muted/30 md:gap-2 md:px-3 md:py-2"
      data-resource-toggle={kind}
    >
      <label
        htmlFor={id}
        className="flex min-w-0 cursor-pointer select-none items-center gap-1.5 md:gap-2"
      >
        <Checkbox
          id={id}
          checked={enabled}
          aria-label={label}
          onCheckedChange={onEnabledChange}
        />
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 md:h-7 md:w-7",
            enabled ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span className="whitespace-nowrap text-xs font-medium text-foreground md:text-sm">
          <span className="sm:hidden">{t(action.shortLabelKey)}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <span className="hidden font-mono text-sm tabular-nums text-foreground md:inline">
          {count}
        </span>
      </label>
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <CompactNumberInput
          value={threshold}
          min={0}
          max={100}
          disabled={!enabled}
          className="w-10"
          aria-label={thresholdLabel}
          title={thresholdLabel}
          onCommit={onThresholdChange}
        />
        %
      </span>
    </div>
  );
}
