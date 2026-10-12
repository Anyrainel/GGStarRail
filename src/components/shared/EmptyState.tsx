import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Without `titleKey` this is the title; with it, a restriction line below. */
  messageKey: MessageKey;
  titleKey?: MessageKey;
  icon?: LucideIcon;
  /** `page`: a page-level hero; `inline`: a quiet line inside a section. */
  variant?: "page" | "inline";
  className?: string;
  /** Actions: outline secondary actions first, then the primary one. */
  children?: ReactNode;
  /** Content below the action row, such as import-method tiles. */
  footer?: ReactNode;
}

export function EmptyState({
  messageKey,
  titleKey,
  icon: Icon = Inbox,
  variant = "page",
  className,
  children,
  footer,
}: EmptyStateProps) {
  const { t } = useI18n();

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground",
          className
        )}
        data-empty-state="inline"
      >
        <Icon className="h-8 w-8" aria-hidden="true" />
        {titleKey && (
          <p className="font-medium text-foreground">{t(titleKey)}</p>
        )}
        <p className="max-w-md">{t(messageKey)}</p>
        {children}
        {footer}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 pb-4 pt-16 text-center md:pt-24",
        className
      )}
      data-empty-state="page"
    >
      <div className="w-full max-w-lg space-y-6">
        <div className="relative mx-auto w-fit">
          <div
            className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
            aria-hidden="true"
          />
          <div className="relative rounded-full border border-border bg-background p-4 shadow-xs">
            <Icon className="h-12 w-12 text-primary" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t(titleKey ?? messageKey)}
          </h2>
          {titleKey && (
            <p className="mx-auto max-w-md text-base text-muted-foreground">
              {t(messageKey)}
            </p>
          )}
        </div>
        {children && (
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {children}
          </div>
        )}
        {footer}
      </div>
    </div>
  );
}
