import { STORAGE_KEYS } from "@/config/identity";

/** Unreleased content is opt-in in every environment, including development. */
export function betaEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.beta) === "true";
  } catch {
    return false;
  }
}

export function setBetaEnabled(enabled: boolean): void {
  // Persist before reloading: if storage fails, don't pretend the mode changed.
  localStorage.setItem(STORAGE_KEYS.beta, String(enabled));
}

export function maybeHandleBetaMagic(value: string): boolean {
  if (value !== "开启测试模式" && value !== "关闭测试模式") return false;
  const enabled = value === "开启测试模式";
  if (enabled !== betaEnabled()) {
    setBetaEnabled(enabled);
    // All catalog consumers and derived caches restart under the new gate.
    window.location.reload();
  }
  return true;
}
