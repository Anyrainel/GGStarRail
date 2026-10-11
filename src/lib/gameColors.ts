import { COMBAT_TYPE_HEADER_RGB, COMBAT_TYPE_RGB } from "@/config/gameColors";

export function combatTypeColor(id: string): string | undefined {
  const rgb = Object.hasOwn(COMBAT_TYPE_RGB, id)
    ? COMBAT_TYPE_RGB[id as keyof typeof COMBAT_TYPE_RGB]
    : undefined;
  return rgb ? `rgb(${rgb.join(", ")})` : undefined;
}

export function combatTypeHeaderColor(id: string): string | undefined {
  const rgb = COMBAT_TYPE_HEADER_RGB[id];
  return rgb ? `rgb(${rgb.join(", ")})` : undefined;
}
