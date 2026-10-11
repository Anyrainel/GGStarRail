import { ChevronDown } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

/**
 * Card grids expand one row at a time, so neighbours stay aligned. The column
 * count follows the grid's `lg:grid-cols-2 xl:grid-cols-3` breakpoints, and a
 * change of column count collapses every row again.
 */
export function useRowExpansion() {
  const isXl = useMediaQuery("(min-width: 1280px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const columns = isXl ? 3 : isLg ? 2 : 1;
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const previousColumns = useRef(columns);
  useEffect(() => {
    if (previousColumns.current === columns) return;
    previousColumns.current = columns;
    setExpandedRows(new Set());
  }, [columns]);
  const toggleRow = useCallback((row: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }, []);
  return {
    rowOf: (index: number) => Math.floor(index / columns),
    isExpanded: (row: number) => expandedRows.has(row),
    toggleRow,
  };
}

const MASK_FADE =
  "linear-gradient(to bottom, black calc(100% - 3rem), transparent)";

/**
 * Clips tall content to `maxHeight` with a fading toggle at the bottom edge.
 * Content that fits renders without a toggle.
 */
export function CollapsibleBody({
  expanded,
  onToggle,
  maxHeight,
  className,
  contentClassName,
  fadeClassName,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** Collapsed height in pixels. */
  maxHeight: number;
  /** Classes of the clipped panel (background, corners, text). */
  className?: string;
  /** Classes of the content inside the panel (padding, spacing). */
  contentClassName?: string;
  /**
   * Gradient that blends the toggle into a flat panel background. Without it
   * the clipped content itself fades out, which suits tinted cards.
   */
  fadeClassName?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    // Measure the content, not the panel: an expanded panel stretches to the
    // tallest card in its row.
    const measure = () => setOverflows(content.offsetHeight > maxHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [maxHeight]);

  const clipped = overflows && !expanded;
  const label = t(expanded ? "archive.showLess" : "archive.showMore");
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "overflow-hidden",
          (!overflows || expanded) && "flex-1",
          className
        )}
        style={
          clipped
            ? {
                maxHeight,
                ...(fadeClassName
                  ? {}
                  : {
                      maskImage: MASK_FADE,
                      WebkitMaskImage: MASK_FADE,
                    }),
              }
            : undefined
        }
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={label}
          title={label}
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-center pb-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            clipped
              ? cn(
                  "absolute inset-x-0 bottom-0 rounded-b-lg pt-8",
                  fadeClassName && cn("bg-gradient-to-t", fadeClassName)
                )
              : "pt-1"
          )}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
