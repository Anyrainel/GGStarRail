import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { RarityStars } from "@/components/shared/RarityStars";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  LightConeDefinition,
  LightConeSuperimposition,
  PathDefinition,
} from "@/providers/reference/types";

export function LightConeDetail({
  lightCone,
  path,
}: {
  lightCone: LightConeDefinition;
  path: PathDefinition;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(lightCone.name, locale));
  const pathName = formatGameText(getLocalizedValue(path.name, locale));
  const scaling = lightCone.stat_scaling.at(-1);
  const stats = scaling
    ? [
        { name: t("stat.short.hp"), value: scaling.stats.hp },
        { name: t("stat.short.atk"), value: scaling.stats.attack },
        { name: t("stat.short.def"), value: scaling.stats.defence },
      ]
    : [];
  const groups = new Map<
    string,
    { name: string; description: string; levels: LightConeSuperimposition[] }
  >();
  for (const level of lightCone.effect.superimpositions) {
    const name = getLocalizedValue(level.name ?? lightCone.effect.name, locale);
    const description = getLocalizedValue(
      level.description ?? lightCone.effect.description,
      locale
    );
    const key = JSON.stringify([name, description]);
    const group = groups.get(key);
    if (group) group.levels.push(level);
    else groups.set(key, { name, description, levels: [level] });
  }
  return (
    <article data-testid="light-cone-detail" className="space-y-5 select-text">
      <div className="flex items-center gap-3 pr-8">
        <ItemIcon
          kind="light-cone"
          id={lightCone.id}
          sourcePath={lightCone.icon_path}
          alt={name}
          rarity={lightCone.rarity}
          size="xl"
        />
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold leading-tight">{name}</h2>
          <RarityStars rarity={lightCone.rarity} />
          <BetaBadge member="light_cones" id={lightCone.id} />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium">
            <AssetImage
              kind="path"
              id={path.id}
              sourcePath={path.icon_path}
              alt=""
              className="h-4 w-4 object-contain"
            />
            {pathName}
          </span>
        </div>
      </div>
      {scaling && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("archive.level", { value: scaling.max_level })}
          </p>
          <dl className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.name}
                className="rounded-lg bg-secondary/60 px-3 py-2"
              >
                <dt className="text-xs text-muted-foreground">{stat.name}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {Math.floor(
                    stat.value.base_value +
                      stat.value.level_add * (scaling.max_level - 1)
                  ).toLocaleString(locale)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {[...groups.entries()].map(([key, group]) => (
        <section
          key={key}
          className="space-y-3 rounded-xl border border-border bg-card/60 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              {formatGameText(group.name, [], t("terms.trailblazer"))}
            </h3>
            {groups.size > 1 && (
              <span className="text-xs text-muted-foreground">
                {t("archive.superimposition", {
                  value: group.levels.map((level) => level.level).join("/"),
                })}
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-sm leading-6">
            {formatGameTextVariants(
              group.description,
              group.levels,
              t("terms.trailblazer")
            )}
          </p>
        </section>
      ))}
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {t("archive.story")}
        </summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {formatGameText(
            getLocalizedValue(lightCone.background_description, locale),
            [],
            t("terms.trailblazer")
          )}
        </p>
      </details>
    </article>
  );
}
