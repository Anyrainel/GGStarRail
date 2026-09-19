export type TrailblazerAppearance = "caelus" | "stelle";

/** One playable kit per Path. Gender-specific game IDs are source aliases. */
export const TRAILBLAZER_FORMS = [
  { id: "8001", caelus: "8001", stelle: "8002" },
  { id: "8003", caelus: "8003", stelle: "8004" },
  { id: "8005", caelus: "8005", stelle: "8006" },
  { id: "8007", caelus: "8007", stelle: "8008" },
  { id: "8009", caelus: "8009", stelle: "8010" },
] as const;

export function trailblazerForm(id: string) {
  return TRAILBLAZER_FORMS.find(
    (form) => form.caelus === id || form.stelle === id
  );
}

export function canonicalCharacterId(id: string): string {
  return trailblazerForm(id)?.id ?? id;
}

export function characterAppearanceId(
  id: string,
  appearance: TrailblazerAppearance
): string {
  return trailblazerForm(id)?.[appearance] ?? id;
}

export function trailblazerAppearance(
  id: string
): TrailblazerAppearance | null {
  const form = trailblazerForm(id);
  return form ? (id === form.stelle ? "stelle" : "caelus") : null;
}
