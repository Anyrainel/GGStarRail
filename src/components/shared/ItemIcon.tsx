import { CircleHelp, LockKeyhole, type LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import type { CatalogAssetRef } from "@/domain/assets";
import { cn } from "@/lib/utils";
import { AssetImage } from "./AssetImage";
import { getRarityColor } from "./colors";

const ICON_CONFIG = {
  xs: {
    icon: 40,
    radius: 6,
    corner: 11,
    cornerOffset: 1,
    cornerRadius: 2,
    cornerFont: 8,
    statusIcon: 7,
    levelHeight: 7,
    levelFont: 8,
    cornerFill: 6,
  },
  sm: {
    icon: 48,
    radius: 8,
    corner: 12,
    cornerOffset: 1.5,
    cornerRadius: 3,
    cornerFont: 9,
    statusIcon: 8,
    levelHeight: 9,
    levelFont: 9,
    cornerFill: 7,
  },
  md: {
    icon: 56,
    radius: 8,
    corner: 14,
    cornerOffset: 1.75,
    cornerRadius: 3.5,
    cornerFont: 10,
    statusIcon: 9,
    levelHeight: 10,
    levelFont: 10,
    cornerFill: 8,
  },
  lg: {
    icon: 64,
    radius: 10,
    corner: 16,
    cornerOffset: 2,
    cornerRadius: 4,
    cornerFont: 11,
    statusIcon: 11,
    levelHeight: 11,
    levelFont: 11,
    cornerFill: 9,
  },
  xl: {
    icon: 80,
    radius: 10,
    corner: 20,
    cornerOffset: 2.5,
    cornerRadius: 5,
    cornerFont: 14,
    statusIcon: 13,
    levelHeight: 14,
    levelFont: 13,
    cornerFill: 10,
  },
} as const;

export type ItemIconSize = keyof typeof ICON_CONFIG;

/** Icon sizes from largest to smallest, for callers that step down to fit. */
export const ITEM_ICON_SIZES = [
  "xl",
  "lg",
  "md",
  "sm",
  "xs",
] as const satisfies readonly ItemIconSize[];

/** Artwork width in CSS pixels for an icon size. */
export function itemIconWidth(size: ItemIconSize): number {
  return ICON_CONFIG[size].icon;
}

/** Artwork height in CSS pixels; follows each kind's card proportions. */
export function itemIconArtworkHeight(
  kind: CatalogAssetRef["kind"],
  size: ItemIconSize,
  square = false
): number {
  const width = ICON_CONFIG[size].icon;
  if (kind === "character") return width * (8 / 7);
  if (kind === "light-cone" && !square) return width * 0.9 * (16 / 11);
  return width;
}

/** Corner radius of a square item tile at this size. */
export function itemIconRadius(size: ItemIconSize): number {
  return ICON_CONFIG[size].radius;
}

/** Corner-chip metrics, for tiles that draw their own badge in the same style. */
export function itemIconCornerMetrics(size: ItemIconSize): {
  size: number;
  offset: number;
  radius: number;
  font: number;
} {
  const config = ICON_CONFIG[size];
  return {
    size: config.corner,
    offset: config.cornerOffset,
    radius: config.cornerRadius,
    font: config.cornerFont,
  };
}

/** The rank-badge colours shared by every item tile. */
export const ITEM_BADGE_CLASS =
  "bg-item-badge font-semibold leading-none text-item-badge-foreground shadow-xs";

interface CornerAsset extends CatalogAssetRef {
  alt: string;
}

export interface ItemIconMarker {
  icon: LucideIcon;
  /** Tooltip and accessible label; repeat it in the icon's `alt` when it matters. */
  label: string;
  tone?: "destructive" | "neutral";
}

export interface ItemIconProps
  extends CatalogAssetRef,
    Omit<React.ComponentPropsWithoutRef<"div">, "children" | "id"> {
  alt: string;
  /** Null renders a neutral frame when the catalog cannot supply a rarity. */
  rarity: number | null;
  /** A compact in-game rank marker: Eidolon, Superimposition, or piece count. */
  badge?: string | number;
  /** Rendered in the attached strip below the artwork. */
  level?: string;
  /** True is locked; null means the importing source could not observe it. */
  locked?: boolean | null;
  /** Optional Path or Combat Type marker when no lock marker takes precedence. */
  cornerAsset?: CornerAsset;
  /** A top-left status chip such as "Not modeled"; ignored when `badge` is set. */
  marker?: ItemIconMarker;
  /** Light Cones only: a square tile cropped from the top of the card art. */
  square?: boolean;
  /** Artwork width preset; height follows the asset kind's card proportions. */
  size?: ItemIconSize;
  imageClassName?: string;
}

const MARKER_TONES: Record<NonNullable<ItemIconMarker["tone"]>, string> = {
  destructive: "bg-destructive text-destructive-foreground",
  neutral: "bg-secondary text-foreground",
};

/**
 * A compact, game-like item portrait. Rarity, level, rank, lock state, and an
 * optional domain marker are deliberately composed into the icon rather than
 * repeated as surrounding text badges.
 */
export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    {
      kind,
      id,
      sourcePath,
      variant,
      alt,
      rarity,
      badge,
      level,
      locked,
      cornerAsset,
      marker,
      square = false,
      size = "lg",
      imageClassName,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const config = ICON_CONFIG[size];
    const lightCone = kind === "light-cone";
    const squareLightCone = lightCone && square;
    const radius = config.radius;
    const cornerRadius = size === "md" ? 3 : config.cornerRadius;
    const showLevel = level !== undefined;
    const showStatus = locked === true || locked === null;
    const showMarker = marker !== undefined && badge === undefined;
    const artworkHeight = itemIconArtworkHeight(kind, size, square);
    const totalHeight = artworkHeight + (showLevel ? config.levelHeight : 0);

    const artwork = (
      <div
        className={cn(
          "relative shrink-0 select-none overflow-hidden",
          !lightCone && "ring-1 ring-inset ring-white/15",
          getRarityColor(rarity, "gradient")
        )}
        data-item-artwork
        data-item-square={squareLightCone ? "" : undefined}
        style={{
          width: config.icon,
          height: artworkHeight,
          borderTopLeftRadius:
            badge === undefined && !showMarker ? radius : cornerRadius,
          borderTopRightRadius:
            showStatus || cornerAsset ? cornerRadius : radius,
          borderBottomRightRadius: radius,
          borderBottomLeftRadius: radius,
        }}
      >
        <AssetImage
          kind={kind}
          id={id}
          sourcePath={sourcePath}
          variant={variant}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(
            "h-full w-full object-contain",
            !lightCone && "drop-shadow-md",
            imageClassName,
            kind === "character" && "object-cover object-bottom",
            // Intrinsic width keeps Chromium's high-quality downsampling for
            // large Light Cone art; object-cover aliases these tiny thumbnails.
            lightCone &&
              !square &&
              "absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-1/2",
            // The square tile crops past the card's thin frame.
            squareLightCone &&
              "absolute -left-[6%] -top-[4%] h-[112%] w-[112%] max-w-none object-cover object-top"
          )}
        />

        {squareLightCone && (
          <span
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0",
              getRarityColor(rarity, "bg") || "bg-muted"
            )}
            style={{ height: Math.max(2, Math.round(config.icon / 20)) }}
            aria-hidden="true"
            data-item-rarity-bar
          />
        )}

        {showMarker && (
          <span
            className={cn(
              "absolute left-0 top-0 flex items-center justify-center shadow-xs",
              MARKER_TONES[marker.tone ?? "destructive"]
            )}
            style={{
              width: config.corner,
              height: config.corner,
              margin: config.cornerOffset,
              borderRadius: config.cornerRadius,
            }}
            role="img"
            title={marker.label}
            aria-label={marker.label}
            data-item-marker={marker.tone ?? "destructive"}
          >
            <marker.icon
              aria-hidden="true"
              style={{ width: config.statusIcon, height: config.statusIcon }}
              strokeWidth={2.5}
            />
          </span>
        )}

        {badge !== undefined && (
          <span
            className={cn(
              "absolute left-0 top-0 flex items-center justify-center",
              ITEM_BADGE_CLASS
            )}
            style={{
              width: config.corner,
              height: config.corner,
              margin: config.cornerOffset,
              borderRadius: config.cornerRadius,
              fontSize: config.cornerFont,
            }}
            data-item-badge={badge}
          >
            {badge}
          </span>
        )}

        {locked === true && (
          <span
            className="absolute right-0 top-0 flex items-center justify-center bg-red-950/90 text-red-200 shadow-xs"
            style={{
              width: config.corner,
              height: config.corner,
              margin: config.cornerOffset,
              borderRadius: config.cornerRadius,
            }}
            data-item-lock="locked"
          >
            <LockKeyhole
              aria-hidden="true"
              style={{ width: config.statusIcon, height: config.statusIcon }}
              strokeWidth={2.5}
            />
          </span>
        )}

        {locked === null && (
          <span
            className="absolute right-0 top-0 flex items-center justify-center bg-slate-950/85 text-slate-200 shadow-xs"
            style={{
              width: config.corner,
              height: config.corner,
              margin: config.cornerOffset,
              borderRadius: config.cornerRadius,
            }}
            data-item-lock="unknown"
          >
            <CircleHelp
              aria-hidden="true"
              style={{ width: config.statusIcon, height: config.statusIcon }}
              strokeWidth={2.5}
            />
          </span>
        )}

        {!showStatus && cornerAsset && (
          <span
            className="absolute right-0 top-0 flex items-center justify-center rounded-full bg-black/45 shadow-xs backdrop-blur-xs"
            style={{
              width: config.corner,
              height: config.corner,
              margin: config.cornerOffset,
            }}
          >
            <AssetImage
              kind={cornerAsset.kind}
              id={cornerAsset.id}
              sourcePath={cornerAsset.sourcePath}
              variant={cornerAsset.variant}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-full w-full object-contain p-px brightness-125"
            />
          </span>
        )}
      </div>
    );

    return (
      <div
        ref={ref}
        role="img"
        aria-label={alt}
        className={cn("block shrink-0", className)}
        style={{
          ...style,
          width: config.icon,
          height: totalHeight,
        }}
        data-item-icon-kind={kind}
        data-item-rarity={rarity ?? "unknown"}
        data-item-level={level}
        {...props}
      >
        <div
          className="flex flex-col"
          style={{ width: config.icon, height: totalHeight }}
        >
          <div className="relative z-10">{artwork}</div>
          {showLevel && (
            <span
              className="flex select-none items-end justify-center bg-item-level font-bold leading-none text-item-level-foreground"
              style={{
                width: config.icon,
                height: config.levelHeight + config.cornerFill,
                marginTop: -config.cornerFill,
                paddingBottom: 1,
                fontSize: config.levelFont,
                borderBottomLeftRadius: radius,
                borderBottomRightRadius: radius,
              }}
            >
              {level}
            </span>
          )}
        </div>
      </div>
    );
  }
);

ItemIcon.displayName = "ItemIcon";
