import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import {
  ItemIcon,
  type ItemIconSize,
  itemIconWidth,
} from "@/components/shared/ItemIcon";
import type { Relic, RelicSlot } from "@/domain/account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { shortStatKey } from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";
import { useTeamDmgData } from "../team/TeamDmgData";

/** Localized Relic slot names (Head … Link Rope). */
export function useSlotName() {
  const { locale } = useI18n();
  const { references } = useTeamDmgData();
  return (slot: RelicSlot) =>
    localizedName(
      references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])?.name,
      locale,
      slot
    );
}

/** Compact stat labels (CRIT DMG → "CD") with the full name as fallback. */
export function useStatName() {
  const { locale, t } = useI18n();
  const { references } = useTeamDmgData();
  const oneDecimal = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });
  return {
    short: (propertyId: string) => {
      const key = shortStatKey(propertyId);
      return key
        ? t(key)
        : localizedPropertyName(propertyId, references.properties, locale);
    },
    full: (propertyId: string) =>
      localizedPropertyName(propertyId, references.properties, locale),
    /** Account stat values as the game shows them (one decimal at most). */
    value: (propertyId: string, value: number) => {
      const ratio =
        references.properties.propertyById.get(propertyId)?.value_kind ===
        "ratio";
      return `${oneDecimal.format(value)}${ratio ? "%" : ""}`;
    },
  };
}

/** An account Relic as a game-like icon with its level, lock and hover card. */
export function RelicPieceIcon({
  relic,
  size,
}: {
  relic: Relic;
  size: ItemIconSize;
}) {
  const { locale } = useI18n();
  const { references } = useTeamDmgData();
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const name = localizedName(piece?.name, locale, relic.definitionId);
  return (
    <CatalogHoverCard kind="relic-piece" id={relic.definitionId} relic={relic}>
      <ItemIcon
        kind="relic-piece"
        id={piece?.id ?? relic.definitionId}
        sourcePath={piece?.icon_path ?? ""}
        rarity={relic.rarity}
        level={`+${relic.level}`}
        locked={relic.locked}
        size={size}
        alt={`${name}, +${relic.level}`}
        tabIndex={0}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </CatalogHoverCard>
  );
}

/**
 * An ideal Relic's main stat as a chip in its slot cell. Head and Hands are
 * fixed (HP, ATK) and shown muted.
 */
export function MainStatChip({
  slot,
  propertyId,
  fixed = false,
  size,
}: {
  slot: RelicSlot;
  propertyId: string | undefined;
  fixed?: boolean;
  size: ItemIconSize;
}) {
  const slotName = useSlotName();
  const stat = useStatName();
  const label = propertyId ? stat.short(propertyId) : "—";
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background/30 px-0.5 py-1 text-center",
        fixed && "bg-transparent"
      )}
      style={{ minHeight: itemIconWidth(size) }}
      title={
        propertyId ? `${slotName(slot)} · ${stat.full(propertyId)}` : undefined
      }
      data-main-stat={propertyId ?? ""}
    >
      <span className="w-full truncate text-[9px] leading-tight text-muted-foreground md:text-[10px] xl:text-[9px] 2xl:text-[10px]">
        {slotName(slot)}
      </span>
      <span
        className={cn(
          "w-full truncate text-[10px] font-bold leading-tight md:text-xs xl:text-[10px] 2xl:text-xs",
          fixed && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
