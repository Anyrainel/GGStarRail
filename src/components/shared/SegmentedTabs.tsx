import type { LucideIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
  /** Accessible name when the visible label is shortened or icon-only. */
  ariaLabel?: string;
  /** Hide the text label below `sm`, keeping the icon. */
  iconOnlyBelowSm?: boolean;
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  fullWidth?: boolean;
  size?: "default" | "sm";
  className?: string;
  /** Links each tab to the panel it controls. */
  panelId?: (value: T) => string;
  tabId?: (value: T) => string;
}

/** A compact tab list with roving focus: arrows, Home and End move and select. */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  fullWidth = false,
  size = "default",
  className,
  panelId,
  tabId,
}: SegmentedTabsProps<T>) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const enabled = items.filter((item) => !item.disabled);
  const focusable = enabled.some((item) => item.value === value)
    ? value
    : enabled[0]?.value;

  function select(next: T) {
    onValueChange(next);
    tabRefs.current.get(next)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!enabled.length) return;
    const index = enabled.findIndex((item) => item.value === value);
    let target: SegmentedTabItem<T> | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = enabled[(index + 1 + enabled.length) % enabled.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target =
          enabled[(index - 1 + enabled.length * 2) % enabled.length] ??
          enabled[enabled.length - 1];
        break;
      case "Home":
        target = enabled[0];
        break;
      case "End":
        target = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (!target) return;
    event.preventDefault();
    select(target.value);
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className={cn(
        "items-center rounded-lg bg-muted p-1 text-muted-foreground",
        size === "sm" ? "h-8" : "h-9",
        fullWidth ? "grid w-full auto-cols-fr grid-flow-col" : "inline-flex",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) tabRefs.current.set(item.value, node);
              else tabRefs.current.delete(item.value);
            }}
            type="button"
            role="tab"
            id={tabId?.(item.value)}
            aria-selected={active}
            aria-controls={panelId?.(item.value)}
            aria-label={
              item.ariaLabel ??
              (item.iconOnlyBelowSm && typeof item.label === "string"
                ? item.label
                : undefined)
            }
            tabIndex={item.value === focusable ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "inline-flex h-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "py-0.5" : "py-1",
              active
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span
              className={cn(
                "truncate",
                item.iconOnlyBelowSm && Icon && "hidden sm:inline"
              )}
            >
              {item.label}
            </span>
            {item.count !== undefined && " "}
            {item.count !== undefined && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
