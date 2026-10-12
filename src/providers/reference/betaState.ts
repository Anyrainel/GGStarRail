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
