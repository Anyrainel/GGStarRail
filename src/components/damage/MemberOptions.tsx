import { useId } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Switch } from "@/components/shared/Switch";
import type { OptionDef } from "@/domain/combat/kit/builder";
import type { MemberOptionGroup } from "@/domain/combat/team/assemble";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogName, localizedName } from "@/lib/catalogPresentation";
import {
  ORIGIN_LABEL_KEYS,
  optionConditionLabel,
  originCatalogName,
} from "@/lib/combat/presentation";
import { formatGameText } from "@/lib/gameText";
import type { CharacterDefinition } from "@/providers/reference/types";
import type { TeamMemberPlan } from "@/stores/teamSchemas";
import { CompactNumberInput, CompactSelect } from "./team/Controls";

type OptionValues = TeamMemberPlan["options"];

interface MemberOptionsProps {
  character: CharacterDefinition;
  references: BuildReferences;
  groups: readonly MemberOptionGroup[];
  values: OptionValues;
  onChange: (values: OptionValues) => void;
}

type OptionValue = boolean | number | string;

interface SourceArt {
  kind: "character" | "light-cone" | "relic-set";
  id: string;
  sourcePath: string | undefined;
}

function OptionControl({
  labelId,
  option,
  value,
  allyName,
  onChange,
}: {
  labelId: string;
  option: OptionDef;
  value: OptionValue | null;
  allyName: (characterId: string) => string;
  onChange: (value: OptionValue) => void;
}) {
  if (option.condition === "ally") {
    const choices = option.choices ?? [];
    const selected =
      typeof value === "string" && choices.includes(value)
        ? value
        : (option.defaultValue as string | null);
    return (
      <CompactSelect
        value={selected ?? ""}
        disabled={choices.length === 0}
        options={choices.map((characterId) => ({
          value: characterId,
          label: allyName(characterId),
        }))}
        display={choices.length === 0 ? "—" : undefined}
        onValueChange={onChange}
        className="ml-auto h-6 max-w-[55%] text-xs xl:h-7 xl:text-sm"
        labelledBy={labelId}
      />
    );
  }
  if (typeof option.defaultValue === "boolean")
    return (
      <Switch
        checked={value === true}
        onCheckedChange={onChange}
        aria-labelledby={labelId}
        className="ml-auto"
      />
    );
  return (
    <CompactNumberInput
      value={
        typeof value === "number"
          ? value
          : typeof option.defaultValue === "number"
            ? option.defaultValue
            : 0
      }
      min={0}
      max={option.max}
      onCommit={(next) => {
        if (next !== null) onChange(next);
      }}
      labelledBy={labelId}
      className="ml-auto h-6 xl:h-7"
    />
  );
}

function OptionRow({
  label,
  art,
  option,
  value,
  allyName,
  onChange,
}: {
  label: string;
  art: SourceArt;
  option: OptionDef;
  value: OptionValue | null;
  allyName: (characterId: string) => string;
  onChange: (value: OptionValue) => void;
}) {
  const labelId = useId();
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-md border border-border p-0.5 md:gap-1 md:p-1"
      data-member-option={option.id}
    >
      <AssetImage
        kind={art.kind}
        id={art.id}
        sourcePath={art.sourcePath}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-5 w-5 shrink-0 rounded-full border border-border bg-muted object-cover object-top xl:h-7 xl:w-7"
      />
      <span
        id={labelId}
        title={label}
        className="min-w-0 flex-1 truncate text-xs font-bold md:text-sm lg:text-xs xl:text-sm"
      >
        {label}
      </span>
      <OptionControl
        labelId={labelId}
        option={option}
        value={value}
        allyName={allyName}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * Kit conditions the battle cannot observe (HP, kills, stacks): one row per
 * option with its source art, label and control. Renders nothing without
 * options.
 */
export function MemberOptions({
  character,
  references,
  groups,
  values,
  onChange,
}: MemberOptionsProps) {
  const { locale, t } = useI18n();
  const allyName = (characterId: string) => {
    const ally = references.characters.byId.get(characterId);
    return ally
      ? characterCatalogName(ally, locale, t("terms.trailblazer"))
      : characterId;
  };

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

  function sourceArt(group: MemberOptionGroup): SourceArt {
    if (group.entity === "character")
      return {
        kind: "character",
        id: character.id,
        sourcePath: character.icon_path,
      };
    if (group.entity === "lightCone")
      return {
        kind: "light-cone",
        id: group.entityId,
        sourcePath: references.lightCones.byId.get(group.entityId)?.icon_path,
      };
    return {
      kind: "relic-set",
      id: group.entityId,
      sourcePath: references.relicSets.byId.get(group.entityId)?.icon_path,
    };
  }

  const entries = groups.flatMap((group) =>
    group.options.map((option) => {
      const condition = optionConditionLabel(option, t);
      const source = sourceName(group, option);
      return {
        group,
        option,
        base: condition ? `${source} · ${condition}` : source,
      };
    })
  );
  if (!entries.length) return null;
  const counts = new Map<string, number>();
  for (const entry of entries)
    counts.set(entry.base, (counts.get(entry.base) ?? 0) + 1);
  const seen = new Map<string, number>();

  return (
    <fieldset
      aria-label={t("combat.member.options")}
      className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0"
    >
      {entries.map(({ group, option, base }) => {
        const key = group.entity;
        const ordinal = (seen.get(base) ?? 0) + 1;
        seen.set(base, ordinal);
        const label =
          (counts.get(base) ?? 0) > 1 ? `${base} (${ordinal})` : base;
        return (
          <OptionRow
            key={`${key}:${option.id}`}
            label={label}
            art={sourceArt(group)}
            option={option}
            allyName={allyName}
            value={values[key]?.[option.id] ?? option.defaultValue}
            onChange={(value) =>
              onChange({
                ...values,
                [key]: { ...values[key], [option.id]: value },
              })
            }
          />
        );
      })}
    </fieldset>
  );
}
