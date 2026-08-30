import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  messageKey: MessageKey;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  messageKey,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/35 p-8 text-center",
        className
      )}
    >
      <div className="rounded-full border border-border bg-background p-3 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {t(messageKey)}
      </p>
    </div>
  );
}
