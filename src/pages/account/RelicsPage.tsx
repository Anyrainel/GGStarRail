import { Gem, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { InventoryToolbar } from "@/components/account/InventoryToolbar";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type RelicCategory,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import { useRelicReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import {
  formatAccountStatValue,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import type { RelicSlotId } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface RelicsPageProps {
  category: RelicCategory;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  emptyKey: MessageKey;
}

type EquipmentStatus =
  | "all"
  | "locked"
  | "unlocked"
  | "unknown-lock"
  | "equipped"
  | "unequipped";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

export default function RelicsPage({
  category,
  titleKey,
  descriptionKey,
  emptyKey,
}: RelicsPageProps) {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const relics = useMemo(
    () =>
      (account?.relics ?? []).filter(
        (relic) => relicCategory(relic.slot) === category
      ),
    [account, category]
  );
  const { data, error, loading } = useRelicReferences();
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<"all" | RelicSlot>("all");
  const [status, setStatus] = useState<EquipmentStatus>("all");

  const visibleRelics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return relics
      .filter((relic) => slot === "all" || relic.slot === slot)
      .filter((relic) => {
        switch (status) {
          case "locked":
            return relic.locked === true;
          case "unlocked":
            return relic.locked === false;
          case "unknown-lock":
            return relic.locked === null;
          case "equipped":
            return relic.equippedCharacterKey !== undefined;
          case "unequipped":
            return relic.equippedCharacterKey === undefined;
          default:
            return true;
        }
      })
      .filter((relic) => {
        if (!normalizedQuery) return true;
        const piece = data?.relicPieces.byId.get(relic.definitionId);
        const setDefinition = data?.relicSets.byId.get(relic.setId);
        return [
          localizedSearchText(piece?.name, relic.definitionId),
          localizedSearchText(setDefinition?.name, relic.setId),
        ].some((searchText) => searchText.includes(normalizedQuery));
      })
      .sort((left, right) => {
        const leftPiece = data?.relicPieces.byId.get(left.definitionId);
        const rightPiece = data?.relicPieces.byId.get(right.definitionId);
        return localizedName(
          leftPiece?.name,
          locale,
          left.definitionId
        ).localeCompare(
          localizedName(rightPiece?.name, locale, right.definitionId),
          locale
        );
      });
  }, [data, locale, query, relics, slot, status]);

  const slotOptions = useMemo(
    () => [
      { value: "all", label: t("filter.allSlots") },
      ...Array.from(new Set(relics.map((relic) => relic.slot)))
        .map((domainSlot) => {
          const slotDefinition = data?.properties.relicSlotById.get(
            DOMAIN_SLOT_TO_CATALOG[domainSlot]
          );
          return {
            value: domainSlot,
            label: localizedName(slotDefinition?.name, locale, domainSlot),
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [data, locale, relics, t]
  );

  const Icon = category === "cavern" ? Gem : Sparkles;
  return (
    <>
      <PageHeader titleKey={titleKey} descriptionKey={descriptionKey} />
      <AccountCoverageNotice account={account} />
      {relics.length === 0 ? (
        account ? (
          <EmptyState messageKey={emptyKey} icon={Icon} />
        ) : (
          <WorkspaceStartState messageKey={emptyKey} icon={Icon} />
        )
      ) : loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <>
          <InventoryToolbar
            query={query}
            searchLabel={t("common.search")}
            searchPlaceholder={t("search.relics")}
            countLabel={t("common.count", { count: visibleRelics.length })}
            onQueryChange={setQuery}
            filters={[
              {
                id: "slot",
                label: t("filter.slot"),
                value: slot,
                options: slotOptions,
                onChange: (value) => setSlot(value as "all" | RelicSlot),
              },
              {
                id: "status",
                label: t("filter.status"),
                value: status,
                options: [
                  { value: "all", label: t("filter.allStatuses") },
                  { value: "locked", label: t("filter.locked") },
                  { value: "unlocked", label: t("filter.unlocked") },
                  { value: "unknown-lock", label: t("filter.unknownLock") },
                  { value: "equipped", label: t("filter.equipped") },
                  { value: "unequipped", label: t("filter.unequipped") },
                ],
                onChange: (value) => setStatus(value as EquipmentStatus),
              },
            ]}
          />
          {visibleRelics.length === 0 ? (
            <EmptyState messageKey="empty.filtered" icon={Icon} />
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleRelics.map((relic) => {
                const piece = data.relicPieces.byId.get(relic.definitionId);
                const setDefinition = data.relicSets.byId.get(relic.setId);
                const name = localizedName(
                  piece?.name,
                  locale,
                  relic.definitionId
                );
                const setName = localizedName(
                  setDefinition?.name,
                  locale,
                  relic.setId
                );
                const slotDefinition = data.properties.relicSlotById.get(
                  DOMAIN_SLOT_TO_CATALOG[relic.slot]
                );
                return (
                  <Card key={relic.key} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <AssetImage
                        kind="relic-piece"
                        id={piece?.id ?? relic.definitionId}
                        sourcePath={piece?.icon_path ?? ""}
                        alt={name}
                        className="h-16 w-16 shrink-0 rounded-lg bg-background/70 object-contain"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <CardTitle className="line-clamp-2 text-base leading-5">
                          {name}
                        </CardTitle>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {setName}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge>+{relic.level}</Badge>
                          <Badge variant="secondary">
                            {t("field.rarity", { value: relic.rarity })}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">
                          {localizedName(
                            slotDefinition?.name,
                            locale,
                            relic.slot
                          )}
                        </Badge>
                        {relic.locked === true && (
                          <Badge variant="outline">{t("field.locked")}</Badge>
                        )}
                        {relic.locked === null && (
                          <Badge variant="outline">
                            {t("field.lockUnknown")}
                          </Badge>
                        )}
                        {relic.equippedCharacterKey && (
                          <Badge variant="outline">{t("field.equipped")}</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("field.mainStat")}
                        </p>
                        <StatLine
                          statId={relic.mainStat.statId}
                          value={relic.mainStat.value}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("field.substats")}
                        </p>
                        {relic.substats.map((stat) => (
                          <StatLine
                            key={stat.statId}
                            statId={stat.statId}
                            value={stat.value}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );

  function StatLine({ statId, value }: { statId: string; value: number }) {
    const property = data?.properties.propertyById.get(statId);
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">
          {localizedName(
            property?.relic_name ?? property?.name,
            locale,
            statId
          )}
        </span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {formatAccountStatValue(value, property, locale)}
        </span>
      </div>
    );
  }
}
