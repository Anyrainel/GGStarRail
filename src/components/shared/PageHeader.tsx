import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface PageHeaderProps {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  eyebrowKey?: MessageKey;
  visuallyHidden?: boolean;
}

export function PageHeader({
  titleKey,
  descriptionKey,
  eyebrowKey,
  visuallyHidden = false,
}: PageHeaderProps) {
  const { t } = useI18n();
  return (
    <header className={visuallyHidden ? "sr-only" : "space-y-1 py-1"}>
      {eyebrowKey && (
        <p className="text-xs font-semibold text-primary">{t(eyebrowKey)}</p>
      )}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
        <p className="max-w-3xl text-sm leading-5 text-muted-foreground">
          {t(descriptionKey)}
        </p>
      </div>
    </header>
  );
}
