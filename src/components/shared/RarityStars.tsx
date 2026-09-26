import { useI18n } from "@/i18n/I18nContext";

export function RarityStars({ rarity }: { rarity: number | null }) {
  const { t } = useI18n();
  if (rarity === null) return null;
  return (
    <span
      role="img"
      aria-label={t("field.rarity", { value: rarity })}
      className="block whitespace-nowrap text-xs leading-none tracking-wider text-[hsl(var(--rarity-star))]"
    >
      {"★".repeat(rarity)}
    </span>
  );
}
