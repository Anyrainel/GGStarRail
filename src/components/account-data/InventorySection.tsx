import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface InventorySectionProps {
  id: string;
  title: string;
  count: number;
  icon: LucideIcon;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function InventorySection({
  id,
  title,
  count,
  icon: Icon,
  defaultExpanded = true,
  children,
}: InventorySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <section className="space-y-3" aria-labelledby={titleId}>
      <div className="rounded-xl border border-border bg-card/70 px-3 py-2 shadow-sm">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <Chevron
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="rounded-md border border-border bg-background/75 p-1.5 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold">
            {title}
          </h2>
          <Badge variant="outline" className="tabular-nums">
            {count}
          </Badge>
        </button>
      </div>
      {expanded && <div id={contentId}>{children}</div>}
    </section>
  );
}
