import { Fragment } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChip } from "@/components/shared/FilterChip";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { useI18n } from "@/i18n/I18nContext";
import type { RelicKind } from "@/services/catalog/relicPresentation";

export interface ResourceSetOption {
  setId: string;
  name: string;
  iconPath: string;
  count: number;
}

export interface ResourceSetGroup {
  kind: RelicKind;
  sets: readonly ResourceSetOption[];
}

/**
 * One scrolling row of set pills, Cavern sets then Planar Ornament sets.
 * Single select: choosing the active set again returns to all sets.
 */
export function ResourceSetStrip({
  label,
  groups,
  value,
  onChange,
}: {
  label: string;
  groups: readonly ResourceSetGroup[];
  value: string | null;
  onChange: (setId: string | null) => void;
}) {
  const { t } = useI18n();
  const visibleGroups = groups.filter((group) => group.sets.length > 0);
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 items-center gap-1.5 overflow-x-auto border-0 p-0 pb-1 scrollbar-none"
      data-resource-set-strip
    >
      <FilterChip
        active={value === null}
        onClick={() => onChange(null)}
        className="h-8 shrink-0 px-3"
      >
        {t("common.all")}
      </FilterChip>
      {visibleGroups.map((group) => (
        <Fragment key={group.kind}>
          <div
            className="mx-0.5 h-5 w-px shrink-0 bg-border"
            aria-hidden="true"
          />
          <RelicKindIcon
            kind={group.kind}
            className="h-4 w-4 text-muted-foreground"
          />
          {group.sets.map((set) => {
            const active = value === set.setId;
            return (
              <FilterChip
                key={set.setId}
                active={active}
                onClick={() => onChange(active ? null : set.setId)}
                count={set.count}
                className="h-8 shrink-0 pl-1 pr-2.5"
                icon={
                  <AssetImage
                    kind="relic-set"
                    id={set.setId}
                    sourcePath={set.iconPath}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                }
              >
                <span className="whitespace-nowrap">{set.name}</span>
              </FilterChip>
            );
          })}
        </Fragment>
      ))}
    </fieldset>
  );
}
