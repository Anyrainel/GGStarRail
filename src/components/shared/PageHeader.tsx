import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface PageHeaderProps {
  titleKey: MessageKey;
  visuallyHidden?: boolean;
}

export function PageHeader({
  titleKey,
  visuallyHidden = false,
}: PageHeaderProps) {
  const { t } = useI18n();
  return (
    <header className={visuallyHidden ? "sr-only" : "py-1"}>
      <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
    </header>
  );
}
