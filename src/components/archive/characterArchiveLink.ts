import { APP_PATHS } from "@/config/navigation";

/** The query parameter the Character archive reads to open one Character. */
export const CHARACTER_ARCHIVE_ID_PARAM = "id";

/** The Character archive, opened on one Character. */
export function characterArchiveHref(characterId: string): string {
  const query = new URLSearchParams({
    [CHARACTER_ARCHIVE_ID_PARAM]: characterId,
  });
  return `${APP_PATHS.archiveCharacters}?${query}`;
}
