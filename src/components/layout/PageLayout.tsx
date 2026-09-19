import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The AppShell owns the app bar; each page fills its remaining viewport. */
export function PageLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
