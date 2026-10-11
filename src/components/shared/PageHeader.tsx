import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  titleKey: MessageKey;
  visuallyHidden?: boolean;
  /** Title-row extras: help button, source age, count, a flex-1 spacer, actions. */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  titleKey,
  visuallyHidden = false,
  children,
  className,
}: PageHeaderProps) {
  const { t } = useI18n();
  if (visuallyHidden) {
    return (
      <header className="sr-only">
        <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
      </header>
    );
  }
  return (
    <header className={cn("flex flex-wrap items-center gap-3 pb-2", className)}>
      <h1 className="text-xl font-bold">{t(titleKey)}</h1>
      {children}
    </header>
  );
}
