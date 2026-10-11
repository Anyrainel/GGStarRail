import { useId } from "react";
import type { StatConstraints } from "@/domain/combat/optimize/idealRelics";
import { useI18n } from "@/i18n/I18nContext";
import { CompactNumberInput } from "../team/Controls";
import { MemberAvatar } from "../team/MemberAvatar";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";

/** Per-member stat floors as typed: SPD, and ERR in percent. */
export interface ChoiceConstraintInput {
  readonly minSpeed: number | null;
  readonly minEnergyRegenPercent: number | null;
}

const NO_CONSTRAINT: ChoiceConstraintInput = {
  minSpeed: null,
  minEnergyRegenPercent: null,
};

/** The engine's constraint for a member, or undefined when none is set. */
export function choiceConstraints(
  input: ChoiceConstraintInput | undefined
): StatConstraints | undefined {
  if (!input) return undefined;
  const constraints: { minSpeed?: number; minEnergyRegen?: number } = {};
  if (input.minSpeed !== null) constraints.minSpeed = input.minSpeed;
  if (input.minEnergyRegenPercent !== null)
    constraints.minEnergyRegen = input.minEnergyRegenPercent / 100;
  return Object.keys(constraints).length ? constraints : undefined;
}

function ConstraintTile({
  characterId,
  name,
  value,
  onChange,
  disabled,
}: {
  characterId: string;
  name: string;
  value: ChoiceConstraintInput;
  onChange: (next: ChoiceConstraintInput) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const speedId = useId();
  const energyId = useId();
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-1.5 py-1 md:px-2 md:py-1.5"
      data-choice-constraint={characterId}
    >
      <legend className="sr-only">{name}</legend>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 md:gap-x-1.5">
        <MemberAvatar characterId={characterId} decorative />
        <span className="flex items-center gap-1">
          <label
            htmlFor={speedId}
            className="whitespace-nowrap text-[10px] font-bold md:text-xs"
          >
            {t("teamChoice.minSpeed")}
          </label>
          <CompactNumberInput
            id={speedId}
            value={value.minSpeed}
            allowEmpty
            min={0}
            max={400}
            step={0.1}
            placeholder="—"
            disabled={disabled}
            onCommit={(minSpeed) => onChange({ ...value, minSpeed })}
            className="h-5 w-11 md:h-6 md:w-14"
          />
        </span>
        <span className="flex items-center gap-1">
          <label
            htmlFor={energyId}
            className="whitespace-nowrap text-[10px] font-bold md:text-xs"
          >
            {t("teamChoice.minEnergyRegen")}
          </label>
          <CompactNumberInput
            id={energyId}
            value={value.minEnergyRegenPercent}
            allowEmpty
            min={0}
            max={200}
            step={0.1}
            placeholder="—"
            disabled={disabled}
            onCommit={(minEnergyRegenPercent) =>
              onChange({ ...value, minEnergyRegenPercent })
            }
            className="h-5 w-10 md:h-6 md:w-12"
          />
          <span className="text-[10px] font-bold md:text-xs">%</span>
        </span>
      </div>
    </fieldset>
  );
}

/** One tile per filled member with the SPD and ERR every candidate keeps. */
export function ChoiceConstraintTiles({
  members,
  values,
  onChange,
  disabled,
}: {
  members: readonly { characterId: string; name: string }[];
  values: Readonly<Record<string, ChoiceConstraintInput>>;
  onChange: (characterId: string, next: ChoiceConstraintInput) => void;
  disabled?: boolean;
}) {
  return (
    <TeamCharacterGrid className="pb-1 md:pb-2">
      {members.map((member) => (
        <ConstraintTile
          key={member.characterId}
          characterId={member.characterId}
          name={member.name}
          value={values[member.characterId] ?? NO_CONSTRAINT}
          onChange={(next) => onChange(member.characterId, next)}
          disabled={disabled}
        />
      ))}
    </TeamCharacterGrid>
  );
}
