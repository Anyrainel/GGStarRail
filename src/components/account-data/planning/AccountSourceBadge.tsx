import { SourceAgeBadge } from "@/components/shared/SourceAgeBadge";
import type { AccountSnapshot } from "@/domain/account/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

const PROVIDER_LABEL: Readonly<
  Record<AccountSnapshot["source"]["provider"], MessageKey>
> = {
  "scanner-export": "source.scanner",
  "uid-showcase": "source.uidShowcase",
  "hoyolab-account": "source.hoyolab",
  "demo-account": "source.demo",
};

/** The title-row pill with the imported account's age and source. */
export function AccountSourceBadge({ account }: { account: AccountSnapshot }) {
  const { t } = useI18n();
  return (
    <SourceAgeBadge
      importedAt={account.source.importedAt}
      sourceLabel={t(PROVIDER_LABEL[account.source.provider])}
    />
  );
}
