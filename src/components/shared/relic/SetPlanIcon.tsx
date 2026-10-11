import { AssetImage } from "@/components/shared/AssetImage";
import { getRarityColor } from "@/components/shared/colors";
import {
  ITEM_BADGE_CLASS,
  ItemIcon,
  type ItemIconSize,
  itemIconCornerMetrics,
  itemIconRadius,
  itemIconWidth,
} from "@/components/shared/ItemIcon";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

/** A Relic set as the plan icons need it; catalog picker items fit this shape. */
export interface SetRef {
  id: string;
  name: string;
  rarity: number | null;
  iconPath?: string | null;
}

interface PlanIconBaseProps {
  size?: ItemIconSize;
  /** Show the active-bonus badge (4, 2+2 or 2). */
  showBadge?: boolean;
  className?: string;
  /** Overrides the accessible name. */
  label?: string;
  /** Hide from assistive technology when a parent already names the plan. */
  decorative?: boolean;
}

function EmptyPlanTile({
  size,
  className,
  label,
  decorative,
}: {
  size: ItemIconSize;
  className?: string;
  label: string;
  decorative: boolean;
}) {
  const width = itemIconWidth(size);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-dashed border-border text-muted-foreground",
        className
      )}
      style={{ width, height: width, borderRadius: itemIconRadius(size) }}
      data-set-plan="empty"
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    />
  );
}

function PlanBadge({ size, text }: { size: ItemIconSize; text: string }) {
  const corner = itemIconCornerMetrics(size);
  return (
    <span
      className={cn(
        "absolute left-0 top-0 z-30 flex items-center justify-center whitespace-nowrap",
        ITEM_BADGE_CLASS
      )}
      style={{
        minWidth: corner.size,
        height: corner.size,
        margin: corner.offset,
        paddingInline: text.length > 1 ? 2 : 0,
        borderRadius: corner.radius,
        fontSize: corner.font,
      }}
      data-item-badge={text}
    >
      {text}
    </span>
  );
}

/** Two Cavern sets on diagonal halves of one rarity-framed tile. */
function SplitPlanTile({
  first,
  second,
  size,
  showBadge,
  className,
  label,
  decorative,
}: {
  first: SetRef;
  second: SetRef;
  size: ItemIconSize;
  showBadge: boolean;
  className?: string;
  label: string;
  decorative: boolean;
}) {
  const { t } = useI18n();
  const width = itemIconWidth(size);
  const rarity =
    first.rarity === null && second.rarity === null
      ? null
      : Math.max(first.rarity ?? 0, second.rarity ?? 0);
  return (
    <div
      className={cn(
        "relative shrink-0 select-none overflow-hidden ring-1 ring-inset ring-white/15",
        getRarityColor(rarity, "gradient"),
        className
      )}
      style={{
        width,
        height: width,
        borderRadius: itemIconRadius(size),
      }}
      data-set-plan="split"
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    >
      <AssetImage
        kind="relic-set"
        id={first.id}
        sourcePath={first.iconPath}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute left-[-6%] top-[-6%] z-10 h-[78%] w-[78%] object-contain drop-shadow-md"
      />
      <AssetImage
        kind="relic-set"
        id={second.id}
        sourcePath={second.iconPath}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute bottom-[-6%] right-[-6%] z-20 h-[78%] w-[78%] object-contain drop-shadow-md"
      />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 z-[15] h-[150%] w-px -translate-x-1/2 -translate-y-1/2 rotate-45 bg-black/25"
        aria-hidden="true"
      />
      {showBadge && <PlanBadge size={size} text={t("relic.plan.twoPlusTwo")} />}
    </div>
  );
}

interface CavernPlanIconProps extends PlanIconBaseProps {
  /** One set is a 4-piece plan; two sets are a 2+2 plan. */
  sets: readonly SetRef[];
}

/** A Cavern Relic plan: a 4-piece set, a 2+2 split tile, or an empty tile. */
export function CavernPlanIcon({
  sets,
  size = "md",
  showBadge = true,
  className,
  label,
  decorative = false,
}: CavernPlanIconProps) {
  const { t } = useI18n();
  const [first, second] = sets;
  if (!first) {
    return (
      <EmptyPlanTile
        size={size}
        className={className}
        label={label ?? t("relic.plan.none")}
        decorative={decorative}
      />
    );
  }
  if (second && second.id !== first.id) {
    return (
      <SplitPlanTile
        first={first}
        second={second}
        size={size}
        showBadge={showBadge}
        className={className}
        label={
          label ??
          t("relic.plan.split", { first: first.name, second: second.name })
        }
        decorative={decorative}
      />
    );
  }
  return (
    <ItemIcon
      kind="relic-set"
      id={first.id}
      sourcePath={first.iconPath}
      rarity={first.rarity}
      size={size}
      badge={showBadge ? 4 : undefined}
      className={className}
      alt={label ?? t("relic.plan.fourPiece", { set: first.name })}
      aria-hidden={decorative || undefined}
      data-set-plan="four"
    />
  );
}

/** An active Cavern set bonus: the set and the pieces it counts. */
export interface CavernBonusRef {
  set: SetRef;
  tier: 2 | 4;
}

interface CavernBonusIconProps extends PlanIconBaseProps {
  bonuses: readonly CavernBonusRef[];
}

/**
 * The Cavern bonuses worn Relics activate: a 4-piece, a 2+2 split tile, a
 * lone 2-piece (with off-set pieces), or an empty tile.
 */
export function CavernBonusIcon({
  bonuses,
  size = "md",
  showBadge = true,
  className,
  label,
  decorative = false,
}: CavernBonusIconProps) {
  const { t } = useI18n();
  const four = bonuses.find((bonus) => bonus.tier === 4);
  const pairs = bonuses.filter((bonus) => bonus.tier === 2);
  const [lone] = pairs;
  if (four || pairs.length !== 1 || !lone)
    return (
      <CavernPlanIcon
        sets={four ? [four.set] : pairs.map((bonus) => bonus.set)}
        size={size}
        showBadge={showBadge}
        className={className}
        label={label}
        decorative={decorative}
      />
    );
  return (
    <ItemIcon
      kind="relic-set"
      id={lone.set.id}
      sourcePath={lone.set.iconPath}
      rarity={lone.set.rarity}
      size={size}
      badge={showBadge ? 2 : undefined}
      className={className}
      alt={label ?? t("relic.plan.twoPiece", { set: lone.set.name })}
      aria-hidden={decorative || undefined}
      data-set-plan="two"
    />
  );
}

interface PlanarSetIconProps extends PlanIconBaseProps {
  set: SetRef | null;
}

/** A Planar Ornament set with its 2-piece badge, or an empty tile. */
export function PlanarSetIcon({
  set,
  size = "md",
  showBadge = true,
  className,
  label,
  decorative = false,
}: PlanarSetIconProps) {
  const { t } = useI18n();
  if (!set) {
    return (
      <EmptyPlanTile
        size={size}
        className={className}
        label={label ?? t("relic.plan.none")}
        decorative={decorative}
      />
    );
  }
  return (
    <ItemIcon
      kind="relic-set"
      id={set.id}
      sourcePath={set.iconPath}
      rarity={set.rarity}
      size={size}
      badge={showBadge ? 2 : undefined}
      className={className}
      alt={label ?? t("relic.plan.planar", { set: set.name })}
      aria-hidden={decorative || undefined}
      data-set-plan="planar"
    />
  );
}

/** A Cavern plan and a Planar set side by side, as in ranking rows. */
export function SetPlanIcons({
  cavern,
  planar,
  size = "sm",
  showBadge = true,
  className,
}: {
  cavern: readonly SetRef[];
  planar: SetRef | null;
  size?: ItemIconSize;
  showBadge?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      data-set-plan-icons
    >
      <CavernPlanIcon sets={cavern} size={size} showBadge={showBadge} />
      <PlanarSetIcon set={planar} size={size} showBadge={showBadge} />
    </div>
  );
}
