import { cn } from "@/lib/utils";

export function ArchiveTabs<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
  panelId,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onValueChange: (value: T) => void;
  className?: string;
  panelId: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex min-w-0 gap-1 overflow-x-auto border-b border-border",
        className
      )}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${panelId}-tab-${option.value}`}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-controls={panelId}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % options.length
                : event.key === "ArrowLeft"
                  ? (index + options.length - 1) % options.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onValueChange(options[next].value);
            document
              .getElementById(`${panelId}-tab-${options[next].value}`)
              ?.focus();
          }}
          className={cn(
            "flex shrink-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3 sm:text-sm",
            value === option.value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
