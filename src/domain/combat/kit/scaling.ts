import type { StatScaling } from "./model";

/**
 * Value of a stat-scaled modifier for a scaling input ("Y +X% of Z exceeding
 * T, per S, up to M"). Shared by turn order and damage evaluation.
 */
export function scaledValue(input: number, scaling: StatScaling): number {
  if (scaling.atLeast !== undefined) {
    return input + 1e-9 >= scaling.atLeast ? scaling.ratio : 0;
  }
  let amount = Math.max(0, input - (scaling.threshold ?? 0));
  if (scaling.step) amount = Math.floor(amount / scaling.step + 1e-9);
  const value = amount * scaling.ratio;
  return scaling.cap === undefined ? value : Math.min(scaling.cap, value);
}
