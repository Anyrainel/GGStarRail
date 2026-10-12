import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TeamSectionCardProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Right side of the header strip (not shown on collapsible cards' trigger). */
  action?: ReactNode;
  /** The header strip toggles the body. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  children: ReactNode;
  /** Stable hook for tests and captures. */
  "data-section"?: string;
}

/**
 * A full-width Team DMG section: a header strip (icon + title) over a dense
 * body. The collapsible variant turns the whole strip into the toggle.
 */
export function TeamSectionCard({
  icon: Icon,
  title,
  action,
  collapsible = false,
  defaultOpen = true,
  className,
  bodyClassName,
  headerClassName,
  children,
  "data-section": section,
}: TeamSectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const titleId = useId();
  const bodyId = useId();
  const expanded = !collapsible || open;
  const heading = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <h3
        id={titleId}
        className="min-w-0 flex-1 truncate text-left text-base font-bold tracking-tight"
      >
        {title}
      </h3>
    </>
  );
  const stripClass =
    "flex w-full items-center gap-2 border-b border-border bg-gradient-select px-2 py-2 md:px-5";

  return (
    <Card
      className={cn("overflow-hidden", className)}
      role="region"
      aria-labelledby={titleId}
      data-team-section={section}
    >
      {collapsible ? (
        <div className={cn(stripClass, !open && "border-b-0")}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {heading}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {action}
        </div>
      ) : (
        <div className={cn(stripClass, headerClassName)}>
          {heading}
          {action}
        </div>
      )}
      {expanded && (
        <div id={bodyId} className={cn("p-1 2xl:p-2", bodyClassName)}>
          {children}
        </div>
      )}
    </Card>
  );
}
