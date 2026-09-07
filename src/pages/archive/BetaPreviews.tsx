import { ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { loadGameMember } from "@/data/gameDataLoader";
import type { BetaPreview, BetaPreviewSection } from "@/data/types";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import { CatalogFailure, CatalogLoading } from "./CatalogControls";

const previewKinds = {
  characters: { member: "nanoka_characters", asset: "character" },
  lightCones: { member: "nanoka_light_cones", asset: "light-cone" },
  relicSets: { member: "nanoka_relic_sets", asset: "relic-set" },
} as const;

const statLabels: Record<string, MessageKey> = {
  hp_base: "beta.stat.hp",
  base_hp: "beta.stat.hp",
  hp_add: "beta.stat.hpGrowth",
  base_hp_add: "beta.stat.hpGrowth",
  attack_base: "beta.stat.attack",
  base_attack: "beta.stat.attack",
  attack_add: "beta.stat.attackGrowth",
  base_attack_add: "beta.stat.attackGrowth",
  defence_base: "beta.stat.defense",
  base_defence: "beta.stat.defense",
  defence_add: "beta.stat.defenseGrowth",
  base_defence_add: "beta.stat.defenseGrowth",
  speed_base: "beta.stat.speed",
  critical_chance: "beta.stat.critRate",
  critical_damage: "beta.stat.critDamage",
  base_aggro: "beta.stat.aggro",
};

export function BetaPreviews({ kind }: { kind: keyof typeof previewKinds }) {
  const { locale, t } = useI18n();
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
      <h2 className="text-lg font-semibold">{t("beta.previews")}</h2>
      <p className="text-sm text-muted-foreground">{t("beta.previewHint")}</p>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {resource.data.map((entry) => (
          <details
            key={entry.id}
            className="group min-w-0 rounded-xl border border-border bg-card p-4"
          >
            <summary className="flex cursor-pointer items-center gap-3">
              <AssetImage
                kind={config.asset}
                id={entry.id}
                sourcePath={entry.image_path}
                alt=""
                className="h-14 w-14 rounded-lg object-contain"
              />
              <span className="flex-1 font-semibold">
                {getLocalizedValue(entry.name, locale)}
              </span>
              <Badge variant="outline">{t("beta.previewBadge")}</Badge>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-4 space-y-4">
              {entry.rarity !== null && (
                <p>{t("field.rarity", { value: entry.rarity })}</p>
              )}
              {Object.keys(entry.stats).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="mb-2 text-left text-xs text-muted-foreground">
                      {t("beta.statOrder")}
                    </caption>
                    <tbody>
                      {Object.entries(entry.stats).map(([key, values]) => (
                        <tr key={key} className="border-b border-border">
                          <th className="py-2 pr-3 font-medium">
                            {statLabels[key] ? t(statLabels[key]) : key}
                          </th>
                          <td className="py-2 tabular-nums">
                            {values
                              .map((value) =>
                                new Intl.NumberFormat(locale, {
                                  maximumFractionDigits: 4,
                                }).format(value)
                              )
                              .join(" / ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {entry.sections.map((section) => (
                <PreviewSection key={section.id} section={section} />
              ))}
              <a
                className="text-sm text-primary underline"
                href={entry.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Nanoka · {entry.source_version}
              </a>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PreviewSection({ section }: { section: BetaPreviewSection }) {
  const { locale, t } = useI18n();
  const [level, setLevel] = useState(0);
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <h3 className="font-medium">
        {getLocalizedValue(section.title, locale)}
      </h3>
      {section.parameters.length > 1 && (
        <select
          aria-label={t("filter.level")}
          className="rounded border border-border bg-background p-2 text-sm"
          value={level}
          onChange={(event) => setLevel(Number(event.target.value))}
        >
          {Array.from(
            { length: section.parameters.length },
            (_, index) => index + 1
          ).map((levelNumber) => (
            <option key={levelNumber} value={levelNumber - 1}>
              {t("field.level", { value: levelNumber })}
            </option>
          ))}
        </select>
      )}
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
