import { useCallback, useState } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { loadGameMember } from "@/data/gameDataLoader";
import type { BetaPreview, BetaPreviewSection } from "@/data/types";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import { CatalogFailure, CatalogLoading } from "./CatalogStatus";

const previewKinds = {
  characters: { member: "nanoka_characters", asset: "character" },
  lightCones: { member: "nanoka_light_cones", asset: "light-cone" },
  relicSets: { member: "nanoka_relic_sets", asset: "relic-set" },
} as const;

const previewStats: readonly {
  keys: readonly string[];
  label: MessageKey;
  ratio?: boolean;
}[] = [
  { keys: ["hp_base", "base_hp"], label: "stat.short.hp" },
  { keys: ["attack_base", "base_attack"], label: "stat.short.atk" },
  { keys: ["defence_base", "base_defence"], label: "stat.short.def" },
  { keys: ["speed_base"], label: "stat.short.spd" },
  { keys: ["critical_chance"], label: "beta.stat.critRate", ratio: true },
  { keys: ["critical_damage"], label: "beta.stat.critDamage", ratio: true },
];

export function BetaPreviews({ kind }: { kind: keyof typeof previewKinds }) {
  const { t } = useI18n();
  const config = previewKinds[kind];
  const loader = useCallback(async () => {
    const document = (await loadGameMember(config.member)) as {
      value: BetaPreview[];
    };
    if (!Array.isArray(document.value))
      throw new Error("Invalid beta preview export");
    return document.value;
  }, [config.member]);
  const resource = useCatalogResource(loader);
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return <CatalogLoading />;
  if (resource.data.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={t("beta.previews")}>
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("beta.previews")}
      </h2>
      <div
        className={cn(
          "grid items-start gap-3",
          kind === "relicSets"
            ? "md:grid-cols-2 xl:grid-cols-3"
            : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
        )}
      >
        {resource.data.map((entry) => (
          <PreviewCard key={entry.id} entry={entry} kind={kind} />
        ))}
      </div>
    </section>
  );
}

function PreviewCard({
  entry,
  kind,
}: {
  entry: BetaPreview;
  kind: keyof typeof previewKinds;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(entry.name, locale));
  const config = previewKinds[kind];
  if (kind === "relicSets")
    return (
      <article className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-3">
          <ItemIcon
            kind={config.asset}
            id={entry.id}
            sourcePath={entry.image_path}
            alt={name}
            rarity={entry.rarity}
            size="sm"
          />
          <div>
            <h3 className="font-semibold">{name}</h3>
            <Badge variant="outline">{t("beta.previewBadge")}</Badge>
          </div>
        </div>
        {entry.sections.map((section) => (
          <PreviewSection key={section.id} section={section} kind={kind} />
        ))}
      </article>
    );
  const stats = previewStats.flatMap((stat) => {
    const key = stat.keys.find(
      (candidate) => entry.stats[candidate]?.[0] !== undefined
    );
    return key ? [{ ...stat, value: entry.stats[key][0] }] : [];
  });
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>
        <button
          type="button"
          aria-label={name}
          className="flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ItemIcon
            kind={config.asset}
            id={entry.id}
            sourcePath={entry.image_path}
            alt={name}
            rarity={entry.rarity}
            size="sm"
          />
          <span className="min-w-0">
            <span className="line-clamp-2 block text-sm font-medium">
              {name}
            </span>
            <Badge variant="outline" className="mt-1">
              {t("beta.previewBadge")}
            </Badge>
          </span>
        </button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        className="md:w-[min(40rem,calc(100vw-2rem))]"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 pr-8">
            <ItemIcon
              kind={config.asset}
              id={entry.id}
              sourcePath={entry.image_path}
              alt={name}
              rarity={entry.rarity}
              size="xl"
            />
            <div className="space-y-2">
              <ResponsiveDialogTitle>{name}</ResponsiveDialogTitle>
              <Badge variant="outline">{t("beta.previewBadge")}</Badge>
            </div>
          </div>
          {stats.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("archive.level", { value: 1 })}
              </p>
              <dl className="grid grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-secondary/60 px-3 py-2"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {t(stat.label)}
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">
                      {formatCatalogValue(
                        stat.value,
                        stat.ratio ? "ratio" : "flat"
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {entry.sections.map((section) => (
            <PreviewSection key={section.id} section={section} kind={kind} />
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function PreviewSection({
  section,
  kind,
}: {
  section: BetaPreviewSection;
  kind: keyof typeof previewKinds;
}) {
  const { locale, t } = useI18n();
  const [level, setLevel] = useState(0);
  const levels = section.parameters.map((_, index) => index + 1);
  const pieces = /^set:([24])$/.exec(section.id)?.[1];
  const title = pieces
    ? t("archive.setPieces", { value: pieces })
    : formatGameText(getLocalizedValue(section.title, locale));
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {section.parameters.length > 1 &&
          (kind === "lightCones" ? (
            <fieldset
              aria-label={t("archive.superimpositionLabel")}
              className="m-0 flex gap-1 rounded-lg border border-border bg-background/70 p-1"
            >
              {levels.map((levelNumber) => (
                <button
                  key={levelNumber}
                  type="button"
                  aria-label={t("archive.superimposition", {
                    value: levelNumber,
                  })}
                  aria-pressed={level === levelNumber - 1}
                  onClick={() => setLevel(levelNumber - 1)}
                  className={cn(
                    "h-7 min-w-8 rounded-md px-1.5 text-xs font-semibold",
                    level === levelNumber - 1
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  S{levelNumber}
                </button>
              ))}
            </fieldset>
          ) : (
            <select
              aria-label={t("filter.level")}
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {levels.map((levelNumber) => (
                <option key={levelNumber} value={levelNumber - 1}>
                  {t("field.level", { value: levelNumber })}
                </option>
              ))}
            </select>
          ))}
      </div>
      {section.description && (
        <p className="whitespace-pre-wrap text-sm leading-6">
          {formatGameText(
            getLocalizedValue(section.description, locale),
            section.parameters[level],
            t("terms.trailblazer")
          )}
        </p>
      )}
    </section>
  );
}
