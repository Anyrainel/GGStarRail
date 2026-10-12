import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useId, useRef } from "react";
import { Switch } from "@/components/shared/Switch";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TriageRules } from "@/domain/build/schemas";
import { useI18n } from "@/i18n/I18nContext";
import { CompactNumberInput } from "./CompactNumberInput";

/** Toolbar popover holding the saved triage thresholds and protections. */
export function TriageRulesPopover({
  rules,
  defaults,
  onChange,
}: {
  rules: TriageRules;
  defaults: TriageRules;
  onChange: (rules: TriageRules) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const ids = {
    keep: `${id}-keep`,
    review: `${id}-review`,
    locked: `${id}-locked`,
    equipped: `${id}-equipped`,
  };
  const isDefault =
    rules.keepScoreAtLeast === defaults.keepScoreAtLeast &&
    rules.reviewScoreAtLeast === defaults.reviewScoreAtLeast &&
    rules.protectLocked === defaults.protectLocked &&
    rules.protectEquipped === defaults.protectEquipped;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("triage.rulesSummary", {
            keep: rules.keepScoreAtLeast,
            review: rules.reviewScoreAtLeast,
          })}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="end"
        collisionPadding={12}
        className="w-72 max-w-[calc(100vw-1.5rem)] space-y-3"
        // Focus the panel, not the first number input, so opening it on a
        // phone does not raise the on-screen keyboard.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("triage.rulesTitle")}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            disabled={isDefault}
            onClick={() => onChange({ ...defaults })}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("triage.restoreDefaults")}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={ids.keep} className="text-sm">
            {t("triage.keepThreshold")}
          </label>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CompactNumberInput
              id={ids.keep}
              value={rules.keepScoreAtLeast}
              min={rules.reviewScoreAtLeast}
              max={100}
              onCommit={(keepScoreAtLeast) =>
                onChange({ ...rules, keepScoreAtLeast })
              }
            />
            %
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={ids.review} className="text-sm">
            {t("triage.reviewThreshold")}
          </label>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CompactNumberInput
              id={ids.review}
              value={rules.reviewScoreAtLeast}
              min={0}
              max={rules.keepScoreAtLeast}
              onCommit={(reviewScoreAtLeast) =>
                onChange({ ...rules, reviewScoreAtLeast })
              }
            />
            %
          </span>
        </div>
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <label
              id={`${ids.locked}-label`}
              htmlFor={ids.locked}
              className="cursor-pointer text-sm"
            >
              {t("triage.protectLocked")}
            </label>
            <Switch
              id={ids.locked}
              aria-labelledby={`${ids.locked}-label`}
              checked={rules.protectLocked}
              onCheckedChange={(protectLocked) =>
                onChange({ ...rules, protectLocked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label
              id={`${ids.equipped}-label`}
              htmlFor={ids.equipped}
              className="cursor-pointer text-sm"
            >
              {t("triage.protectEquipped")}
            </label>
            <Switch
              id={ids.equipped}
              aria-labelledby={`${ids.equipped}-label`}
              checked={rules.protectEquipped}
              onCheckedChange={(protectEquipped) =>
                onChange({ ...rules, protectEquipped })
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
