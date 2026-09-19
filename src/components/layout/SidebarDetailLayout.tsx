import { ArrowLeft } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface SidebarDetailLayoutProps {
  header?: ReactNode;
  mobileDetailHeader?: ReactNode;
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
  mobileDetailHeader,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useGlobalScroll(containerRef, mainRef);

  if (!isDesktop) {
    if (hasSelection) {
      return (
        <div
          className={cn(
            "container flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-2",
            className
          )}
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
          {mobileDetailHeader && (
            <div className="shrink-0 pb-2">{mobileDetailHeader}</div>
          )}
          <section
            aria-label={detailLabel}
            className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pt-px pb-4"
          >
            {children}
          </section>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "container flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-2",
          className
        )}
        data-sidebar-detail-layout="mobile-browse"
      >
        {banner}
        {header && <div className="shrink-0 pt-px pb-2">{header}</div>}
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {mobileGrid ?? sidebar}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "container flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-2 md:px-4",
        className
      )}
      data-sidebar-detail-layout="desktop"
    >
      {banner}
      {header && <div className="shrink-0 pt-px pb-2">{header}</div>}
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 pb-2 lg:gap-3 lg:pb-3">
        <aside
          aria-label={sidebarLabel}
          className={cn(
            "relative shrink-0 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card/50 p-2 pr-1",
            sidebarWidth,
            sidebarClassName
          )}
        >
          {sidebar}
        </aside>
        <section
          ref={mainRef}
          aria-label={detailLabel}
          className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </section>
      </div>
    </div>
  );
}
