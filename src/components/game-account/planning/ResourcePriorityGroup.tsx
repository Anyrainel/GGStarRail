import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/** A collapsible bordered group of suggestion rows, like GGArtifact's tier rows. */
export function ResourcePriorityGroup({
  label,
  count,
  collapsed,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <section
      aria-label={label}
      className="rounded-lg border border-border bg-gradient-card"
      data-resource-group
    >
      <h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className={cn(
            "flex w-full select-none items-center gap-1 px-3 py-2 text-left text-base font-bold tracking-wide text-foreground transition-colors hover:bg-accent/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            collapsed ? "rounded-lg" : "rounded-t-lg"
          )}
        >
          <Chevron className="h-5 w-5 shrink-0" aria-hidden="true" />
          {label}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            ({count})
          </span>
        </button>
      </h2>
      {!collapsed && (
        <div
          id={bodyId}
          className="grid grid-cols-1 gap-1.5 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {children}
        </div>
      )}
    </section>
  );
}
