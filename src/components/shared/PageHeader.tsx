import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface PageHeaderProps {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  eyebrowKey?: MessageKey;
}

export function PageHeader({
  titleKey,
  descriptionKey,
  eyebrowKey = "app.foundation",
}: PageHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        {t(eyebrowKey)}
      </p>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t(titleKey)}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {t(descriptionKey)}
        </p>
      </div>
    </header>
  );
}
