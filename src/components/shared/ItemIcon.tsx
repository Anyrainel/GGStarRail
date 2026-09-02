import { CircleHelp, LockKeyhole } from "lucide-react";
import { forwardRef } from "react";
import type { CatalogAssetRef } from "@/domain/assets";
import { cn } from "@/lib/utils";
import { AssetImage } from "./AssetImage";

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

interface CornerAsset extends CatalogAssetRef {
  alt: string;
}

export interface ItemIconProps
  extends CatalogAssetRef,
    Omit<React.ComponentPropsWithoutRef<"div">, "children" | "id"> {
  alt: string;
  rarity: number;
  /** A compact in-game rank marker: Eidolon, Superimposition, or piece count. */
  badge?: string | number;
  /** Rendered in the attached strip below the artwork. */
  level?: string;
  /** True is locked; null means the importing source could not observe it. */
  locked?: boolean | null;
  /** Optional Path or Combat Type marker when no lock marker takes precedence. */
  cornerAsset?: CornerAsset;
  size?: ItemIconSize;
  imageClassName?: string;
}

function rarityBackground(rarity: number): string {
  switch (rarity) {
    case 5:
      return "linear-gradient(180deg, #a35d55, #d0aa6e)";
    case 4:
      return "linear-gradient(180deg, #3f4064, #9c65d7)";
    case 3:
      return "linear-gradient(180deg, #3a3b62, #4c86c9)";
    case 2:
      return "linear-gradient(180deg, #374760, #44908c)";
    default:
      return "linear-gradient(180deg, #3e404e, #88888e)";
  }
}

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
      alt,
      rarity,
      badge,
      level,
      locked,
      cornerAsset,
      size = "lg",
      imageClassName,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const config = ICON_CONFIG[size];
    const showLevel = level !== undefined;
    const showStatus = locked === true || locked === null;
    const totalHeight = config.icon + (showLevel ? config.levelHeight : 0);

    const artwork = (
      <div
        className="relative shrink-0 select-none overflow-hidden ring-1 ring-inset ring-white/15"
        data-item-artwork
        style={{
          backgroundImage: rarityBackground(rarity),
          width: config.icon,
          height: config.icon,
          borderTopLeftRadius:
            badge === undefined ? config.radius : config.cornerRadius,
          borderTopRightRadius:
            showStatus || cornerAsset ? config.cornerRadius : config.radius,
          borderBottomRightRadius: config.radius,
          borderBottomLeftRadius: config.radius,
        }}
      >
        <AssetImage
          kind={kind}
          id={id}
          sourcePath={sourcePath}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(
            "h-full w-full object-contain drop-shadow-md",
            imageClassName
          )}
        />

        {badge !== undefined && (
          <span
            className="absolute left-0 top-0 flex items-center justify-center bg-[#4a3b2a] font-semibold leading-none text-[#f3d88c] shadow-sm"
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
            className="absolute right-0 top-0 flex items-center justify-center bg-red-950/90 text-red-200 shadow-sm"
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
            className="absolute right-0 top-0 flex items-center justify-center bg-slate-950/85 text-slate-200 shadow-sm"
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
            className="absolute right-0 top-0 flex items-center justify-center rounded-full bg-black/45 shadow-sm backdrop-blur-sm"
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
        data-item-rarity={rarity}
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
              className="flex select-none items-end justify-center bg-[#f5f0e6] font-bold leading-none text-[#3d3d3d]"
              style={{
                width: config.icon,
                height: config.levelHeight + config.cornerFill,
                marginTop: -config.cornerFill,
                paddingBottom: 1,
                fontSize: config.levelFont,
                borderBottomLeftRadius: config.radius,
                borderBottomRightRadius: config.radius,
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
