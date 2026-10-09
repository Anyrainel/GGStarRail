import type { BuildConfiguration } from "@/domain/build/schemas";
import type { Locale } from "@/i18n/locales";
import type { BuildReferences } from "./buildReferences";
import { localizedName } from "./catalogPresentation";

export function buildDisplayName(
  build: BuildConfiguration,
  references: BuildReferences,
  locale: Locale
): string {
  if (build.name !== undefined) return build.name;
  const character = localizedName(
    references.characters.byId.get(build.characterDefinitionId)?.name,
    locale,
    build.characterDefinitionId
  );
  const setIds =
    build.category === "planar"
      ? [build.planarSetId]
      : build.cavern.mode === "four-piece"
        ? [build.cavern.setId]
        : build.cavern.setIds;
  const sets = setIds
    .map((id) =>
      localizedName(references.relicSets.byId.get(id)?.name, locale, id)
    )
    .join(" + ");
  const name = `${character} · ${sets}`;
  return name.length > 80 ? `${name.slice(0, 79)}…` : name;
}
