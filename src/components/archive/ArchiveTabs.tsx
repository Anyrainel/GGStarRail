import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A tab chosen by keyboard may render inside a different layout, which
 * remounts this list; the new list takes the focus from here.
 */
let pendingFocusId: string | null = null;

/** Catalog tabs as a centred pill, the first row of an archive toolbar. */
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
  const listRef = useRef<HTMLDivElement>(null);
  const tabId = (option: T) => `${panelId}-tab-${option}`;
  const selectedTabId = tabId(value);

  useEffect(() => {
    // A phone can scroll the strip; keep the selected tab inside it.
    const list = listRef.current;
    const tab = document.getElementById(selectedTabId);
    if (!list || !tab || !list.contains(tab)) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.left < listBox.left) {
      list.scrollLeft -= listBox.left - tabBox.left;
    } else if (tabBox.right > listBox.right) {
      list.scrollLeft += tabBox.right - listBox.right;
    }
  }, [selectedTabId]);

  useEffect(() => {
    // Wait for the render that shows the requested tab as selected; the
    // previous list can render once more before it is replaced.
    if (!pendingFocusId || pendingFocusId !== tabId(value)) return;
    const target = document.getElementById(pendingFocusId);
    if (!target || !listRef.current?.contains(target)) return;
    pendingFocusId = null;
    if (document.activeElement !== target) target.focus();
  });

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn(
        "mx-auto inline-flex h-9 w-max max-w-full items-center overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground scrollbar-none",
        className
      )}
    >
      {options.map((option, index) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            id={tabId(option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
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
              pendingFocusId = tabId(options[next].value);
              onValueChange(options[next].value);
              document.getElementById(pendingFocusId)?.focus();
            }}
            className={cn(
              "inline-flex h-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
              active
                ? "bg-background text-foreground shadow"
                : "hover:text-foreground"
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
