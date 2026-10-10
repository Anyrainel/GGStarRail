import { useId } from "react";
import type { OptionDef } from "@/domain/combat/kit/builder";
import type { MemberOptionGroup } from "@/domain/combat/team/assemble";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import { localizedName } from "@/lib/catalogPresentation";
import {
  ORIGIN_LABEL_KEYS,
  optionConditionLabel,
  originCatalogName,
} from "@/lib/combat/presentation";
import { formatGameText } from "@/lib/gameText";
import type { CharacterDefinition } from "@/providers/reference/types";
import type { TeamMemberPlan } from "@/stores/teamSchemas";

type OptionValues = TeamMemberPlan["options"];

interface MemberOptionsProps {
  character: CharacterDefinition;
  references: BuildReferences;
  groups: readonly MemberOptionGroup[];
  values: OptionValues;
  onChange: (values: OptionValues) => void;
}

function OptionControl({
  label,
  option,
  value,
  onChange,
}: {
  label: string;
  option: OptionDef;
  value: boolean | number;
  onChange: (value: boolean | number) => void;
}) {
  const id = useId();
  if (typeof option.defaultValue === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/50"
      >
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      </label>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <label htmlFor={id} className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={option.max}
        step={1}
        value={typeof value === "number" ? value : option.defaultValue}
        className="h-7 w-14 rounded-md border border-border bg-background/70 px-2 text-right tabular-nums"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next))
            onChange(Math.min(option.max ?? next, Math.max(0, next)));
        }}
      />
    </div>
  );
}

/** Kit conditions the battle cannot observe (HP, kills, stacks), per source. */
export function MemberOptions({
  character,
  references,
  groups,
  values,
  onChange,
}: MemberOptionsProps) {
  const { locale, t } = useI18n();

  function groupKey(group: MemberOptionGroup): string {
    return group.entity === "character" || group.entity === "lightCone"
      ? group.entity
      : group.entity;
  }

  function sourceName(group: MemberOptionGroup, option: OptionDef): string {
    if (group.entity === "lightCone") {
      const lightCone = references.lightCones.byId.get(group.entityId);
      return formatGameText(
        localizedName(lightCone?.name, locale, group.entityId)
      );
    }
    if (group.entity !== "character") {
      const set = references.relicSets.byId.get(group.entityId);
      return formatGameText(localizedName(set?.name, locale, group.entityId));
    }
    const origin = t(ORIGIN_LABEL_KEYS[option.origin]);
    const name = originCatalogName(option.origin, character, locale);
    return name ? `${origin} · ${name}` : origin;
  }

  const labels = groups.flatMap((group) =>
    group.options.map((option) => {
      const condition = optionConditionLabel(option, t);
      const source = sourceName(group, option);
      return condition ? `${source} · ${condition}` : source;
    })
  );
  const duplicates = new Set(
    labels.filter((label, index) => labels.indexOf(label) !== index)
  );
  let position = 0;

  return (
    <fieldset
      className="space-y-0.5 text-xs"
      aria-label={t("combat.member.options")}
    >
      <legend className="mb-1 font-medium text-muted-foreground">
        {t("combat.member.options")}
      </legend>
      {groups.map((group) => {
        const key = groupKey(group);
        return group.options.map((option) => {
          const base = labels[position] ?? option.id;
          position += 1;
          const ordinal = duplicates.has(base)
            ? labels.slice(0, position).filter((label) => label === base).length
            : 0;
          const label = ordinal > 0 ? `${base} (${ordinal})` : base;
          return (
            <OptionControl
              key={`${key}:${option.id}`}
              label={label}
              option={option}
              value={values[key]?.[option.id] ?? option.defaultValue}
              onChange={(value) =>
                onChange({
                  ...values,
                  [key]: { ...values[key], [option.id]: value },
                })
              }
            />
          );
        });
      })}
    </fieldset>
  );
}
