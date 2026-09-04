import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface SidebarDetailLayoutProps {
  header?: ReactNode;
  sidebar: ReactNode;
  mobileGrid?: ReactNode;
  children: ReactNode;
  hasSelection: boolean;
  onBack: () => void;
  backLabel: string;
  sidebarLabel?: string;
  detailLabel?: string;
  sidebarWidth?: string;
  className?: string;
  sidebarClassName?: string;
  banner?: ReactNode;
}

export function SidebarDetailLayout({
  header,
  sidebar,
  mobileGrid,
  children,
  hasSelection,
  onBack,
  backLabel,
  sidebarLabel,
  detailLabel,
  sidebarWidth = "w-1/3 max-w-[18rem]",
  className,
  sidebarClassName,
  banner,
}: SidebarDetailLayoutProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!isDesktop) {
    if (hasSelection) {
      return (
        <div
          className={cn("flex min-w-0 flex-col", className)}
          data-sidebar-detail-layout="mobile-detail"
        >
          {banner}
          <div className="shrink-0 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Button>
          </div>
          <section
            aria-label={detailLabel}
            className="min-w-0 flex-1 pt-px pb-4"
          >
            {children}
          </section>
        </div>
      );
    }

    return (
      <div
        className={cn("min-w-0", className)}
        data-sidebar-detail-layout="mobile-browse"
      >
        {banner}
        {header && <div className="shrink-0 pt-px pb-2">{header}</div>}
        {mobileGrid ?? sidebar}
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-w-0 flex-col", className)}
      data-sidebar-detail-layout="desktop"
    >
      {banner}
      {header && <div className="shrink-0 pt-px pb-2">{header}</div>}
      <div className="flex min-w-0 flex-1 items-start gap-2 lg:gap-3">
        <aside
          aria-label={sidebarLabel}
          className={cn(
            "sticky top-0 max-h-[calc(100dvh-14rem)] shrink-0 overflow-y-auto rounded-lg border border-border bg-card/50 p-2 pr-1",
            sidebarWidth,
            sidebarClassName
          )}
        >
          {sidebar}
        </aside>
        <section aria-label={detailLabel} className="min-w-0 flex-1">
          {children}
        </section>
      </div>
    </div>
  );
}
