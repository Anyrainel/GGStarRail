import { useState } from "react";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  LightConeDefinition,
  PathDefinition,
} from "@/providers/gilore/types";
import { LightConeDetail } from "./LightConeDetail";

export function LightConeCard({
  lightCone,
  path,
}: {
  lightCone: LightConeDefinition;
  path: PathDefinition;
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = formatGameText(getLocalizedValue(lightCone.name, locale));
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <button
          type="button"
          data-light-cone-id={lightCone.id}
          aria-label={name}
          className="flex h-full min-h-20 items-center gap-2 rounded-lg border border-border bg-card/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ItemIcon
            kind="light-cone"
            id={lightCone.id}
            sourcePath={lightCone.icon_path}
            alt={name}
            rarity={lightCone.rarity}
            size="sm"
          />
          <span className="min-w-0 space-y-1">
            <span className="line-clamp-2 block text-sm font-medium leading-tight">
              {name}
            </span>
            <BetaBadge member="light_cones" id={lightCone.id} />
          </span>
        </button>
      </ResponsiveDialogTrigger>
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
