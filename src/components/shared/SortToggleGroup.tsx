import { ArrowDown, ArrowUp, type LucideIcon, Minus } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

export type SortDirection = "off" | "asc" | "desc";

const OPTIONS: readonly {
  value: SortDirection;
  icon: LucideIcon;
  labelKey: MessageKey;
}[] = [
  { value: "off", icon: Minus, labelKey: "common.sort.off" },
  { value: "asc", icon: ArrowUp, labelKey: "common.sort.asc" },
  { value: "desc", icon: ArrowDown, labelKey: "common.sort.desc" },
];

/** Grid helper for a column of labelled sort toggles. */
export const SORT_TOGGLE_GRID_CLASS =
  "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2";

interface SortToggleGroupProps {
  value: SortDirection;
  onChange: (value: SortDirection) => void;
  /** Accessible name of the group, usually the sorted field. */
  label: string;
  disabled?: boolean;
  /** Shown as the tooltip while disabled. */
  disabledReason?: string;
  className?: string;
}

/** Three joined toggles: no sort, ascending and descending. */
export function SortToggleGroup({
  value,
  onChange,
  label,
  disabled = false,
  disabledReason,
  className,
}: SortToggleGroupProps) {
  const { t } = useI18n();
  return (
    <fieldset
      aria-label={label}
      title={disabled ? disabledReason : undefined}
      className={cn("m-0 inline-flex min-w-0 border-0 p-0", className)}
    >
      {OPTIONS.map((option, index) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={t(option.labelKey)}
            title={disabled ? disabledReason : t(option.labelKey)}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 w-9 items-center justify-center border border-border outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              index === 0 && "rounded-l-sm",
              index === OPTIONS.length - 1 && "rounded-r-sm",
              index > 0 && "-ml-px",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </fieldset>
  );
}
