import { useState } from "react";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { RarityStars } from "@/components/shared/RarityStars";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/game/text";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  LightConeDefinition,
  PathDefinition,
} from "@/providers/reference/types";
import { LightConeDetail } from "./LightConeDetail";

export function LightConeCard({
  lightCone,
  path,
}: {
  lightCone: LightConeDefinition;
  path: PathDefinition;
}) {
  const { locale, t } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  // Focus returns to the tile when the dialog closes; keep the preview shut
  // until the pointer or focus actually moves on.
  const [previewHeld, setPreviewHeld] = useState(false);
  const name = formatGameText(getLocalizedValue(lightCone.name, locale));
  const release = () => setPreviewHeld(false);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreviewHeld(true);
      }}
    >
      <CatalogHoverCard
        kind="light-cone"
        id={lightCone.id}
        disabled={!isDesktop || open || previewHeld}
      >
        <ResponsiveDialogTrigger asChild>
          <button
            type="button"
            data-light-cone-id={lightCone.id}
            aria-label={name}
            aria-description={t("field.rarity", { value: lightCone.rarity })}
            onBlur={release}
            onPointerLeave={release}
            className="flex h-full min-w-0 items-center gap-2 rounded-lg bg-card/50 p-2 text-left transition-all hover:scale-[1.02] hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ItemIcon
              kind="light-cone"
              id={lightCone.id}
              sourcePath={lightCone.icon_path}
              alt={name}
              rarity={lightCone.rarity}
              size="xs"
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="line-clamp-2 min-w-0 text-sm font-medium leading-tight">
                  {name}
                </span>
                <BetaBadge member="light_cones" id={lightCone.id} />
              </span>
              <RarityStars rarity={lightCone.rarity} />
            </span>
          </button>
        </ResponsiveDialogTrigger>
      </CatalogHoverCard>
      <ResponsiveDialogContent
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        className="md:w-[min(36rem,calc(100vw-2rem))]"
      >
        <ResponsiveDialogTitle className="sr-only">
          {name}
        </ResponsiveDialogTitle>
        <LightConeDetail lightCone={lightCone} path={path} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
