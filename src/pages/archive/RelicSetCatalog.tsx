import { useEffect, useMemo, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import {
  getLocalizedValue,
  isPropertyDefinitionV1_1,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type {
  ProgressionTables,
  PropertyCatalog,
  RelicPieceDefinition,
  RelicSetDefinition,
} from "@/providers/gilore/types";
import {
  CatalogEmpty,
  CatalogFailure,
  CatalogLoading,
  CatalogSearch,
} from "./CatalogControls";
import {
  CatalogDetailSheet,
  useCatalogDetailSheet,
} from "./CatalogDetailSheet";
import { CatalogSourceDisclosure } from "./CatalogSourceDisclosure";

async function loadRelicArchiveData() {
  const [relicSets, relicPieces, propertyTables, progression] =
    await Promise.all([
      loadRelicSets(),
      loadRelicPieces(),
      loadPropertyTables(),
      loadProgression(),
    ]);
  return { relicSets, relicPieces, propertyTables, progression };
}

interface LogicalRelicPiece {
  key: string;
  setId: string;
  slot: RelicPieceDefinition["slot"];
  representative: RelicPieceDefinition;
  variants: readonly RelicPieceDefinition[];
}

function logicalPieces(
  variants: readonly RelicPieceDefinition[]
): readonly LogicalRelicPiece[] {
  const groups = new Map<string, RelicPieceDefinition[]>();
  for (const variant of variants) {
    const key = `${variant.set_id}:${variant.slot}`;
    const group = groups.get(key) ?? [];
    group.push(variant);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, entries]) => {
    const sorted = [...entries].sort(
      (left, right) => right.rarity - left.rarity
    );
    return {
      key,
      setId: sorted[0]?.set_id ?? "",
      slot: sorted[0]?.slot ?? "HEAD",
      representative: sorted[0]!,
      variants: sorted,
    };
  });
}

export function RelicSetCatalog() {
  const { locale, t } = useI18n();
  const resource = useCatalogResource(loadRelicArchiveData);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    open: detailOpen,
    setOpen: setDetailOpen,
    openOnNarrowScreen,
    restoreTriggerFocus,
  } = useCatalogDetailSheet();

  const filtered = useMemo(() => {
    if (!resource.data) return [];
    const needle = query.trim().toLocaleLowerCase();
    return [...resource.data.relicSets.values]
      .filter((set) => {
        if (kind !== "all" && set.kind !== kind) return false;
        if (!needle) return true;
        const localizedValues = (["en", "zh-CN"] as const).flatMap(
          (searchLocale) => [
            getLocalizedValue(set.name, searchLocale),
            ...set.bonuses.map((bonus) =>
              getLocalizedValue(bonus.description, searchLocale)
            ),
          ]
        );
        return `${localizedValues.join(" ")} ${set.id}`
          .toLocaleLowerCase()
          .includes(needle);
      })
      .sort((left, right) =>
        formatGameText(getLocalizedValue(left.name, locale)).localeCompare(
          formatGameText(getLocalizedValue(right.name, locale)),
          locale
        )
      );
  }, [kind, locale, query, resource.data]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((entry) => entry.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;

  const { relicSets, relicPieces, propertyTables, progression } = resource.data;
  const allLogicalPieces = logicalPieces(relicPieces.values);
  const selected = selectedId ? relicSets.byId.get(selectedId) : undefined;
  const selectedPieces = selected
    ? allLogicalPieces.filter((piece) => piece.setId === selected.id)
    : [];
  const selectedName = selected
    ? formatGameText(getLocalizedValue(selected.name, locale))
    : "";
  const selectedDetail = selected ? (
    <RelicSetDetail
      relicSet={selected}
      pieces={selectedPieces}
      propertyTables={propertyTables}
    />
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/55 p-3 xl:flex-row xl:items-center">
        <CatalogSearch
          value={query}
          onChange={setQuery}
          placeholderKey="archive.search.relicSets"
        />
        <fieldset
          className="m-0 flex min-w-0 gap-1.5 overflow-x-auto border-0 p-0 pb-1 scrollbar-none"
          aria-label={t("filter.kind")}
        >
          {[
            ["all", t("filter.allKinds")],
            ["cavern_relic", t("archive.kind.cavern")],
            ["planar_ornament", t("archive.kind.planar")],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={kind === value ? "default" : "outline"}
              className="shrink-0 rounded-full"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
        </fieldset>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("archive.relicResults", {
          shown: filtered.length,
          total: relicSets.values.length,
          logical: allLogicalPieces.length,
          variants: relicPieces.values.length,
        })}
      </p>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={t("archive.relicSetList")}
        >
          {filtered.length === 0 ? (
            <CatalogEmpty />
          ) : (
            filtered.map((set) => (
              <RelicSetCard
                key={set.id}
                relicSet={set}
                selected={set.id === selected?.id}
                onSelect={(trigger) => {
                  setSelectedId(set.id);
                  openOnNarrowScreen(trigger);
                }}
              />
            ))
          )}
        </section>
        {selectedDetail && (
          <>
            <div className="hidden min-w-0 lg:block">{selectedDetail}</div>
            <CatalogDetailSheet
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onCloseAutoFocus={restoreTriggerFocus}
              title={selectedName}
            >
              {selectedDetail}
            </CatalogDetailSheet>
          </>
        )}
      </div>

      <ReferenceTables
        propertyTables={propertyTables}
        progression={progression}
      />
    </div>
  );
}

function RelicSetCard({
  relicSet,
  selected,
  onSelect,
}: {
  relicSet: RelicSetDefinition;
  selected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(relicSet.name, locale));
  return (
    <button
      type="button"
      onClick={(event) => onSelect(event.currentTarget)}
      aria-pressed={selected}
      data-relic-set-id={relicSet.id}
      className="group overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={
          selected
            ? "h-full border-primary/60 bg-primary/10"
            : "h-full transition-colors group-hover:border-primary/35 group-hover:bg-secondary/45"
        }
      >
        <CardContent className="flex items-center gap-3 p-3">
          <AssetImage
            kind="relic-set"
            id={relicSet.id}
            sourcePath={relicSet.icon_path}
            alt={name}
            className="h-20 w-20 shrink-0 rounded-lg bg-background/60 object-contain"
          />
          <span className="min-w-0 space-y-2">
            <span className="line-clamp-2 block font-semibold">{name}</span>
            <Badge variant="secondary">
              {relicSet.kind === "cavern_relic"
                ? t("archive.kind.cavern")
                : t("archive.kind.planar")}
            </Badge>
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

function RelicSetDetail({
  relicSet,
  pieces,
  propertyTables,
}: {
  relicSet: RelicSetDefinition;
  pieces: readonly LogicalRelicPiece[];
  propertyTables: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(relicSet.name, locale));
  const provenance = relicSet.name[locale].provenance;
  return (
    <aside
      data-testid="relic-set-detail"
      className="min-w-0 space-y-5 overflow-hidden rounded-xl border border-border bg-card/75 p-4 lg:sticky lg:top-0"
    >
      <div className="flex items-center gap-4">
        <AssetImage
          kind="relic-set"
          id={relicSet.id}
          sourcePath={relicSet.icon_path}
          alt={name}
          className="h-28 w-28 shrink-0 rounded-xl bg-background/60 object-contain"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {relicSet.kind === "cavern_relic"
              ? t("archive.kind.cavern")
              : t("archive.kind.planar")}
          </p>
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-xs text-muted-foreground">
            {t("archive.releaseVersion", { value: relicSet.release_version })}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("archive.setBonuses")}</h3>
        {relicSet.bonuses.map((bonus) => (
          <div
            key={bonus.required_pieces}
            className="rounded-lg border border-primary/25 bg-primary/5 p-3"
          >
            <Badge>
              {t("archive.pieceBonus", { value: bonus.required_pieces })}
            </Badge>
            <p className="mt-2 break-words whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {formatGameText(
                getLocalizedValue(bonus.description, locale),
                bonus.parameters
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">
          {t("archive.logicalPieces", { value: pieces.length })}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {pieces.map((piece) => {
            const slot = propertyTables.relicSlotById.get(piece.slot);
            const pieceName = formatGameText(
              getLocalizedValue(piece.representative.name, locale)
            );
            return (
              <div
                key={piece.key}
                className="flex gap-3 rounded-lg border border-border bg-background/45 p-2"
              >
                <AssetImage
                  kind="relic-piece"
                  id={piece.representative.id}
                  sourcePath={piece.representative.icon_path}
                  alt={pieceName}
                  className="h-16 w-16 shrink-0 rounded-md object-contain"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">
                    {pieceName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {slot
                      ? formatGameText(getLocalizedValue(slot.name, locale))
                      : piece.slot}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {piece.variants.map((variant) => (
                      <Badge key={variant.id} variant="outline">
                        {variant.rarity} ★
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CatalogSourceDisclosure
        revision={provenance.source_revision}
        path={provenance.source_path}
      />
    </aside>
  );
}

function ReferenceTables({
  propertyTables,
  progression,
}: {
  propertyTables: PropertyCatalog;
  progression: ProgressionTables;
}) {
  const { locale, t } = useI18n();
  return (
    <details className="rounded-xl border border-border bg-card/55 p-4">
      <summary className="cursor-pointer font-semibold">
        {t("archive.referenceTables")}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="mt-1 text-sm text-muted-foreground">
          {t("archive.referenceTablesHint")}
        </p>

        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold">
            {t("archive.taxonomyCounts", {
              paths: propertyTables.paths.length,
              combatTypes: propertyTables.combatTypes.length,
              slots: propertyTables.relicSlots.length,
            })}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ReferenceIconList
              title={t("archive.paths")}
              entries={propertyTables.paths.map((path) => ({
                kind: "path" as const,
                id: path.id,
                sourcePath: path.icon_path,
                name: formatGameText(getLocalizedValue(path.name, locale)),
              }))}
            />
            <ReferenceIconList
              title={t("archive.combatTypes")}
              entries={propertyTables.combatTypes.map((combatType) => ({
                kind: "combat-type" as const,
                id: combatType.id,
                sourcePath: combatType.icon_path,
                name: formatGameText(
                  getLocalizedValue(combatType.name, locale)
                ),
              }))}
            />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t("archive.slots")}</h3>
              {propertyTables.relicSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <span>
                    {formatGameText(getLocalizedValue(slot.name, locale))}
                  </span>
                  <code className="ml-2 text-muted-foreground">{slot.id}</code>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold">
            {t("archive.propertiesCount", {
              value: propertyTables.properties.length,
            })}
          </summary>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {propertyTables.properties.map((property) => {
              const propertyName = formatGameText(
                getLocalizedValue(
                  property.relic_name ?? property.name,
                  locale
                ) ?? t("archive.sourceValueMissing")
              );
              return (
                <div
                  key={property.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <AssetImage
                    kind="property"
                    id={property.id}
                    sourcePath={
                      isPropertyDefinitionV1_1(property)
                        ? property.usable_icon_path
                        : property.icon_path === "0"
                          ? null
                          : property.icon_path
                    }
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-contain"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {propertyName}
                    </p>
                    <code className="block truncate text-[10px] text-muted-foreground">
                      {property.id}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold">
            {t("archive.affixCounts", {
              main: progression.relic_main_affixes.length,
              sub: progression.relic_sub_affixes.length,
            })}
          </summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <AffixTable
              title={t("archive.mainAffixes")}
              rows={progression.relic_main_affixes.map((affix) => {
                const property = propertyTables.propertyById.get(
                  affix.property_id
                );
                return {
                  key: `${affix.group_id}:${affix.affix_id}`,
                  property: formatGameText(
                    getLocalizedValue(
                      property?.relic_name ?? property?.name,
                      locale
                    ) ?? affix.property_id
                  ),
                  group: affix.group_id,
                  values: `${formatCatalogValue(
                    affix.base_value,
                    property?.value_kind ?? "unknown"
                  )} → ${formatCatalogValue(
                    affix.level_values.at(-1) ?? affix.base_value,
                    property?.value_kind ?? "unknown"
                  )}`,
                };
              })}
            />
            <AffixTable
              title={t("archive.subAffixes")}
              rows={progression.relic_sub_affixes.map((affix) => {
                const property = propertyTables.propertyById.get(
                  affix.property_id
                );
                return {
                  key: `${affix.group_id}:${affix.affix_id}`,
                  property: formatGameText(
                    getLocalizedValue(
                      property?.relic_name ?? property?.name,
                      locale
                    ) ?? affix.property_id
                  ),
                  group: affix.group_id,
                  values: affix.roll_values
                    .map((value) =>
                      formatCatalogValue(
                        value,
                        property?.value_kind ?? "unknown"
                      )
                    )
                    .join(" · "),
                };
              })}
            />
          </div>
        </details>

        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold">
            {t("archive.scoringCounts", {
              mainBases:
                progression.relic_scoring.main_affix_base_values.length,
              subBases: progression.relic_scoring.sub_affix_base_values.length,
              characters:
                progression.relic_scoring.main_affix_character_weights.length,
            })}
          </summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("archive.sourceScoringHint")}
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <AffixTable
              title={t("archive.mainScoreBases")}
              rows={progression.relic_scoring.main_affix_base_values.map(
                (row) => ({
                  key: row.property_id,
                  property: row.property_id,
                  group: row.score_type,
                  values: `${row.base_value} · ${row.value_per_level ?? "—"}`,
                })
              )}
            />
            <AffixTable
              title={t("archive.subScoreBases")}
              rows={progression.relic_scoring.sub_affix_base_values.map(
                (row) => ({
                  key: row.property_id,
                  property: row.property_id,
                  group: row.score_type,
                  values: `${row.base_value}`,
                })
              )}
            />
          </div>
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {t("archive.characterWeights")}
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {progression.relic_scoring.main_affix_character_weights.map(
                (row) => (
                  <div
                    key={row.character_id}
                    className="rounded-md bg-secondary/55 p-2 text-xs"
                  >
                    <code>{row.character_id}</code>
                    <p className="mt-1 text-muted-foreground">
                      {Object.entries(row.weights)
                        .map(([key, value]) => `${key} ${value}`)
                        .join(" · ")}
                    </p>
                  </div>
                )
              )}
            </div>
          </details>
        </details>
      </div>
    </details>
  );
}

function ReferenceIconList({
  title,
  entries,
}: {
  title: string;
  entries: readonly {
    kind: "path" | "combat-type";
    id: string;
    sourcePath: string;
    name: string;
  }[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 rounded-md border border-border p-2"
        >
          <AssetImage
            kind={entry.kind}
            id={entry.id}
            sourcePath={entry.sourcePath}
            alt=""
            className="h-8 w-8 rounded object-contain"
          />
          <span className="text-xs">{entry.name}</span>
          <code className="ml-auto text-[10px] text-muted-foreground">
            {entry.id}
          </code>
        </div>
      ))}
    </div>
  );
}

function AffixTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly {
    key: string;
    property: string;
    group: string | number;
    values: string;
  }[];
}) {
  const { t } = useI18n();
  return (
    <div className="min-w-0 overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <table className="w-full min-w-[430px] text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pb-2 pr-3">{t("archive.property")}</th>
            <th className="pb-2 pr-3">{t("archive.group")}</th>
            <th className="pb-2">{t("archive.values")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="py-2 pr-3">{row.property}</td>
              <td className="py-2 pr-3 font-mono">{row.group}</td>
              <td className="py-2 font-mono text-muted-foreground">
                {row.values}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
