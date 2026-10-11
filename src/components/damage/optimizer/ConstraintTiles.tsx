import { useId } from "react";
import type { StatConstraints } from "@/domain/combat/optimize/idealRelics";
import { useI18n } from "@/i18n/I18nContext";
import { CompactNumberInput } from "../team/Controls";
import { MemberAvatar } from "../team/MemberAvatar";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";

/**
 * Per-member stat floors as typed: SPD, and ERR as the in-game panel total in
 * percent (100 = no bonus).
 */
export interface MemberConstraintInput {
  readonly minSpeed: number | null;
  readonly minEnergyRegenPercent: number | null;
}

/** The panel's ERR total starts at 100%; the engine works with the bonus. */
const BASE_ENERGY_REGEN_PERCENT = 100;

export const NO_CONSTRAINT: MemberConstraintInput = {
  minSpeed: null,
  minEnergyRegenPercent: null,
};

/** The engine's constraint for a member, or undefined when none is set. */
export function statConstraints(
  input: MemberConstraintInput | undefined
): StatConstraints | undefined {
  if (!input) return undefined;
  const constraints: { minSpeed?: number; minEnergyRegen?: number } = {};
  if (input.minSpeed !== null) constraints.minSpeed = input.minSpeed;
  if (input.minEnergyRegenPercent !== null)
    constraints.minEnergyRegen = Math.max(
      0,
      (input.minEnergyRegenPercent - BASE_ENERGY_REGEN_PERCENT) / 100
    );
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
  value: MemberConstraintInput;
  onChange: (next: MemberConstraintInput) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const speedId = useId();
  const energyId = useId();
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-1.5 py-1 md:px-2 md:py-1.5"
      data-constraint-tile
    >
      <legend className="sr-only">{name}</legend>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 md:gap-x-1.5">
        <MemberAvatar characterId={characterId} decorative />
        <span className="flex items-center gap-1">
          <label
            htmlFor={speedId}
            className="whitespace-nowrap text-[10px] font-bold md:text-xs"
          >
            {t("teamOptimizer.minSpeed")}
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
            {t("teamOptimizer.minEnergyRegen")}
          </label>
          <CompactNumberInput
            id={energyId}
            value={value.minEnergyRegenPercent}
            allowEmpty
            min={BASE_ENERGY_REGEN_PERCENT}
            max={200}
            step={0.1}
            placeholder="—"
            disabled={disabled}
            onCommit={(minEnergyRegenPercent) =>
              onChange({ ...value, minEnergyRegenPercent })
            }
            className="h-5 w-11 md:h-6 md:w-14"
          />
          <span className="text-[10px] font-bold md:text-xs">%</span>
        </span>
      </div>
    </fieldset>
  );
}

/** One tile per filled member with its SPD and ERR floors. */
export function ConstraintTiles({
  members,
  values,
  onChange,
  disabled,
}: {
  members: readonly { slot: number; characterId: string; name: string }[];
  values: Readonly<Record<number, MemberConstraintInput>>;
  onChange: (slot: number, next: MemberConstraintInput) => void;
  disabled?: boolean;
}) {
  return (
    <TeamCharacterGrid className="pb-1 md:pb-2">
      {members.map((member) => (
        <ConstraintTile
          key={member.slot}
          characterId={member.characterId}
          name={member.name}
          value={values[member.slot] ?? NO_CONSTRAINT}
          onChange={(next) => onChange(member.slot, next)}
          disabled={disabled}
        />
      ))}
    </TeamCharacterGrid>
  );
}
