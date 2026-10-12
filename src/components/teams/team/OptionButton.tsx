import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A row of radio "mode cards" placed directly under a section header strip.
 * Arrow keys move the selection like a native radio group.
 */
export function OptionButtonRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    const radios = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]:not(:disabled)'
      ),
    ];
    const index = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = radios[(index + step + radios.length) % radios.length];
    next?.focus();
    next?.click();
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-stretch gap-1 px-1 py-2 md:px-2 lg:gap-2 xl:px-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function OptionButton({
  selected,
  onSelect,
  title,
  subtitle,
  icon,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  /** Facts only (counts, scenario facts). */
  subtitle?: ReactNode;
  /** Replaces the radio dot. */
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1">
      {/* biome-ignore lint/a11y/useSemanticElements: radio card button */}
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "flex h-full w-full min-w-0 flex-wrap items-baseline rounded-lg border-2 px-2 py-1.5 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2",
          selected
            ? "border-primary bg-primary/10"
            : "border-border bg-background/20 hover:bg-accent/30"
        )}
      >
        <span className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2 md:shrink-0">
          {icon ?? (
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center self-center rounded-full border-2",
                selected ? "border-primary" : "border-muted-foreground"
              )}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
          )}
          <span className="min-w-0 break-words text-sm font-bold leading-tight sm:truncate sm:leading-normal md:text-base lg:text-lg">
            {title}
          </span>
        </span>
        {subtitle && (
          <span className="min-w-0 basis-full pl-[1.375rem] text-[10px] leading-snug text-muted-foreground sm:truncate sm:pl-6 md:ml-2 md:basis-auto md:whitespace-normal md:pl-0 md:text-xs md:leading-tight">
            {subtitle}
          </span>
        )}
      </button>
    </div>
  );
}
