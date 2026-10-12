import { useI18n } from "@/i18n/I18nContext";
import { isBetaEntity } from "@/providers/reference/gameDataLoader";

export function BetaBadge({
  member,
  id,
}: {
  member: string;
  id: string | number;
}) {
  const { t } = useI18n();
  return isBetaEntity(member, id) ? (
    <span
      className="inline-flex shrink-0 items-center rounded border border-border px-1 py-0.5 text-[9px] font-semibold uppercase leading-none text-muted-foreground"
      data-beta-badge
    >
      {t("beta.badge")}
    </span>
  ) : null;
}
