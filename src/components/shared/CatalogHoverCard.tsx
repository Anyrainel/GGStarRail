import * as HoverCard from "@radix-ui/react-hover-card";
import { type ReactElement, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import type { Relic } from "@/domain/account/schemas";
import type { CatalogAssetKind } from "@/domain/assets";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogName,
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { combatTypeColor } from "@/lib/gameColors";
import { formatGameText } from "@/lib/gameText";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import { groupLightConeEffects } from "@/lib/lightConeEffects";
import { ItemIcon } from "./ItemIcon";

interface CatalogHoverCardProps {
  kind: CatalogAssetKind;
  id: string;
  children: ReactElement;
  disabled?: boolean;
  relic?: Relic;
}

/** Shared by tier items, build portraits, equipment pickers, and owned Relics. */
export function CatalogHoverCard({
  kind,
  id,
  children,
  disabled,
  relic,
}: CatalogHoverCardProps) {
  const [open, setOpen] = useState(false);
  const compact = useMediaQuery("(max-width: 639px)");
  return (
    <HoverCard.Root
      open={open && !disabled}
      onOpenChange={setOpen}
      openDelay={350}
      closeDelay={120}
    >
      <HoverCard.Trigger
        asChild
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onPointerDown={() => setOpen(false)}
      >
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side={compact ? "bottom" : "right"}
          sideOffset={10}
          collisionPadding={12}
          className="z-[100] max-h-[min(32rem,var(--radix-hover-card-content-available-height))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
          onEscapeKeyDown={() => setOpen(false)}
        >
          {open && !disabled && (
            <CatalogHoverContent kind={kind} id={id} relic={relic} />
          )}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function CatalogHoverContent({
  kind,
  id,
  relic,
}: Pick<CatalogHoverCardProps, "kind" | "id" | "relic">) {
  const { data, error, loading } = useBuildReferences();
  const { locale, t } = useI18n();
  if (loading) return <CatalogLoading />;
  if (!data || error) return <CatalogLoadError error={error} />;
  const character =
    kind === "character" ? data.characters.byId.get(id) : undefined;
  const cone = kind === "light-cone" ? data.lightCones.byId.get(id) : undefined;
  const piece =
    kind === "relic-piece" ? data.relicPieces.byId.get(id) : undefined;
  const set = data.relicSets.byId.get(
    kind === "relic-set" ? id : (piece?.set_id ?? "")
  );
  const entry = character ?? cone ?? piece ?? set;
  if (!entry) return <p>{t("empty.filtered")}</p>;
  const name = character
    ? characterCatalogName(character, locale, t("terms.trailblazer"))
    : formatGameText(localizedName(entry.name, locale, id));
  const pathId = character?.path_id ?? cone?.path_id;
  const path = pathId ? data.properties.pathById.get(pathId) : undefined;
  const combatType = character
    ? data.properties.combatTypeById.get(character.combat_type_id)
    : undefined;
  const scaling = character?.stat_scaling.at(-1) ?? cone?.stat_scaling.at(-1);
  return (
    <article className="space-y-3 select-text" aria-label={name}>
      <header className="flex items-center gap-3">
        <ItemIcon
          kind={kind}
          id={id}
          sourcePath={entry.icon_path}
          alt=""
          rarity={"rarity" in entry ? entry.rarity : null}
          size="lg"
        />
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-bold">{name}</h3>
          {"rarity" in entry && (
            <p className="text-xs text-primary">{"★".repeat(entry.rarity)}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {combatType && (
              <span style={{ color: combatTypeColor(combatType.id) }}>
                {localizedName(combatType.name, locale, combatType.id)}
              </span>
            )}
            {path && <span>{localizedName(path.name, locale, path.id)}</span>}
            {relic && <span>+{relic.level}</span>}
          </div>
        </div>
      </header>
      {scaling && (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">
            {t("archive.level", { value: scaling.max_level })}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {[
              [t("stat.short.hp"), scaling.stats.hp],
              [t("stat.short.atk"), scaling.stats.attack],
              [t("stat.short.def"), scaling.stats.defence],
            ].map(
              ([label, stat]) =>
                typeof stat === "object" && (
                  <div key={String(label)}>
                    <dt className="text-xs text-muted-foreground">
                      {String(label)}
                    </dt>
                    <dd>
                      {Math.floor(
                        stat.base_value +
                          stat.level_add * (scaling.max_level - 1)
                      ).toLocaleString(locale)}
                    </dd>
                  </div>
                )
            )}
          </dl>
        </div>
      )}
      {character?.description && (
        <p className="text-sm leading-relaxed">
          {formatGameText(
            localizedName(character.description, locale, ""),
            [],
            t("terms.trailblazer")
          )}
        </p>
      )}
      {cone &&
        [...groupLightConeEffects(cone, locale)].map(([key, group]) => (
          <section
            key={key}
            className="space-y-1 border-t border-border pt-2 text-sm"
          >
            <h4 className="font-semibold">
              {formatGameText(group.name, [], t("terms.trailblazer"))}
            </h4>
            <p className="whitespace-pre-line leading-relaxed">
              {formatGameTextVariants(
                group.description,
                group.levels,
                t("terms.trailblazer")
              )}
            </p>
          </section>
        ))}
      {relic && (
        <dl className="space-y-1 border-t border-border pt-2 text-sm">
          {[relic.mainStat, ...relic.substats].map((stat, index) => (
            <div
              key={stat.statId}
              className={
                index === 0
                  ? "flex justify-between gap-2 font-semibold text-primary"
                  : "flex justify-between gap-2"
              }
            >
              <dt>
                {localizedPropertyName(stat.statId, data.properties, locale)}
              </dt>
              <dd>
                {formatAccountStatValue(
                  stat.value,
                  data.properties.propertyById.get(stat.statId),
                  locale
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {set && (
        <section className="space-y-2 border-t border-border pt-2 text-sm">
          {piece && (
            <h4 className="font-semibold">
              {localizedName(set.name, locale, set.id)}
            </h4>
          )}
          {set.bonuses.map((bonus) => (
            <p key={bonus.required_pieces} className="leading-relaxed">
              <span className="mr-1 font-semibold text-primary">
                {t("archive.setPieces", { value: bonus.required_pieces })}
              </span>
              {formatGameText(
                localizedName(bonus.description, locale, ""),
                bonus.parameters,
                t("terms.trailblazer")
              )}
            </p>
          ))}
        </section>
      )}
    </article>
  );
}
