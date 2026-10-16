import type { ReferenceLocale } from "@/domain/provenance";
import { STORAGE_KEYS } from "./identity";

let selected: ReferenceLocale | undefined;

/** Shared by UI transports and workers; never causes a catalog request. */
export function getReferenceLocale(): ReferenceLocale {
  if (selected) return selected;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.locale);
    if (stored === "en" || stored === "zh-CN") return stored;
  } catch {
    /* Workers receive the selected locale with their job. */
  }
  return typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en";
}

export function setReferenceLocale(locale: ReferenceLocale): void {
  selected = locale;
}
