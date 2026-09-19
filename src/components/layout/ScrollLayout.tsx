import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface ScrollLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
}

/** Fixed toolbar and a bounded content scroller, shared with GGArtifact. */
export function ScrollLayout({
  header,
  children,
  className,
  headerClassName,
  bodyClassName,
  bodyRef,
}: ScrollLayoutProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
        className
      )}
    >
      {header && (
        <div
          className={cn("container shrink-0 pb-2 2xl:pb-4", headerClassName)}
        >
          {header}
        </div>
      )}
      <div
        ref={bodyRef}
        data-scroll-body
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className={cn("container min-h-full pb-4", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
