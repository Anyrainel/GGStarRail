import { useI18n } from "@/i18n/I18nContext";

export function RarityStars({ rarity }: { rarity: number | null }) {
  const { t } = useI18n();
  if (rarity === null) return null;
  return (
    <span
      role="img"
      aria-label={t("field.rarity", { value: rarity })}
      className="block text-xs leading-none tracking-wider text-primary"
    >
      {"★".repeat(rarity)}
    </span>
  );
}
