import type { ReactNode } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { cn } from "@/lib/utils";

const supportsContainerQueries =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("container-type", "inline-size");

/** Columns for browsers without container queries (same breakpoints). */
function fallbackColumns(width: number | null): string | null {
  if (supportsContainerQueries || width === null) return null;
  const rem =
    typeof document === "undefined"
      ? 16
      : Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize
        ) || 16;
  if (width >= 66 * rem) return "grid-cols-4";
  if (width >= 32.5 * rem) return "grid-cols-2";
  return "grid-cols-1";
}

/**
 * Per-member columns sized by the card's own width (container queries), so
 * every per-member block lines up across cards: 1 column, 2 from 32.5rem,
 * 4 from 66rem.
 */
export function TeamCharacterGrid({
  children,
  className,
  gridClassName,
}: {
  children: ReactNode;
  /** Classes for the measuring wrapper (padding goes here). */
  className?: string;
  /** Classes for the grid itself (gap overrides go here). */
  gridClassName?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn("min-w-0 [container-type:inline-size]", className)}
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-1 lg:gap-2 [@container(min-width:32.5rem)]:grid-cols-2 [@container(min-width:66rem)]:grid-cols-4",
          fallbackColumns(width),
          gridClassName
        )}
        data-team-character-grid
      >
        {children}
      </div>
    </div>
  );
}
