import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarPanelProps {
  /** Accessible name of the sidebar region. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** The card chrome for a filter sidebar: a bordered, scrolling column of sections. */
export function SidebarPanel({
  label,
  children,
  className,
}: SidebarPanelProps) {
  return (
    <aside aria-label={label} className={cn("h-full min-h-0", className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/50">
        <div className="flex-1 space-y-4 overflow-y-auto py-4 pl-4 pr-3 xl:space-y-6 xl:py-6 xl:pl-6 xl:pr-4">
          {children}
        </div>
      </div>
    </aside>
  );
}

interface SidebarSectionProps {
  title: ReactNode;
  /** Right-aligned header control, such as a clear button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({
  title,
  action,
  children,
  className,
}: SidebarSectionProps) {
  return (
    <section className={cn("space-y-2 xl:space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold xl:text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface SidebarClearButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** A small pill that resets a sidebar or one of its sections. */
export function SidebarClearButton({
  label,
  onClick,
  disabled,
}: SidebarClearButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-6 rounded-full px-3 text-xs"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
